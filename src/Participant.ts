import * as vscode from 'vscode';
import * as EventEmitter from 'events';

interface Request {
  prompt: string;
  command: string;
}

interface Command {
  handler: (request: Request, stream: any, token: vscode.CancellationToken) => Promise<void>;
}

class Participant extends EventEmitter.EventEmitter {
  protected systemPrompt: string;
  protected codeTag: string;
  protected commands: { [key: string]: Command };
  public codeblocks: string[];

  private markdown: string;

  constructor(commands: { [key: string]: Command }) {
    super();
    this.systemPrompt = "You are a friendly participant in a chat. You have been asked to provide some information.";
    this.commands = commands;
    this.codeblocks = [];
    this.codeTag = "js";
    this.markdown = '';
  }

  // This method is one of the key aspects to running a participant
  // as it allows you to work with the user's prompt before sending off
  // that means you can add the "expert" part of your participant here
  // as needed. For tone and style, you should use the system prompt in the
  // constructor.
  async defaultResponse(request: Request, stream: any, token: vscode.CancellationToken): Promise<string> {
    return this.send(request.prompt, stream, token);
  }

  // Pulls fenced codeblocks out of the markdown and stores them
  // so you can run if you like
  parseCodeBlocks(md: string): void {
    const pattern = new RegExp(`(?<=\`\`\`${this.codeTag}).+?(?=\`\`\`)`, "gs");
    this.codeblocks = md.match(pattern) || [];
  }

  // Sends a prompt to the language model and streams the response
  // to the chat window. Also caches the markdown for later use.
  async send(prompt: string, stream: any, token: vscode.CancellationToken): Promise<string> {
    const sendMessages = [
      vscode.LanguageModelChatMessage.User(this.systemPrompt),
      vscode.LanguageModelChatMessage.User(prompt)
    ];

    const MODEL_SELECTOR = { vendor: 'copilot', family: 'gpt-4o' };
    const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);

    const response = await model.sendRequest(sendMessages, {}, token);

    const fullResponse: string[] = [];
    for await (const fragment of response.text) {
      fullResponse.push(fragment);
      stream.markdown(fragment);
    }
    const markdown = fullResponse.join("");
    this.parseCodeBlocks(markdown);
    return this.markdown;
  }

  // Called from the extension.ts file, the primary entry point for all chat requests
  async handle(request: Request, context: any, stream: any, token: vscode.CancellationToken): Promise<void> {
    const prompt = request.prompt.trim();
    const command = request.command;

    // Ensure we have an action to perform, if not, show the help
    if (prompt === "" && !command) {
      // There should always be a help command
      const helpCommand = this.commands.help;
      return helpCommand.handler(request, stream, token);
    } else {
      // Check the commands hash to see if we have a handler
      const commandHandler = this.commands[request.command];
      if (commandHandler) {
        await commandHandler.handler(request, stream, token);
      } else {
        // Do the default response
        const md = await this.defaultResponse(request, stream, token);
        this.emit("sent", { stream, md });
        // IMPORTANT: at this point, the stream is closed and we can no longer
        // interact with the chat window. If you need to notify the user of anything,
        // you'll have to pop up a notification. You can also do followup providers
        // or add a button. See the "sent" event handler in the PG constructor for an example of that.
      }
    }
  }
}

export default Participant;