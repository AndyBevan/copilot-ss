import * as vscode from 'vscode';
import * as fs from "fs";
import * as path from "path";
import assert from 'assert';

// Abstracts the idea of a /command in the chat
// which can fire off a handler
class Command {
  name: string;
  handler: (request: any, stream: any, token: vscode.CancellationToken) => Promise<void>;

  constructor(name: string, handler: (request: any, stream: any, token: vscode.CancellationToken) => Promise<void>) {
    assert(name, "Command must have a name");
    assert(handler, "Command must have a handler");
    this.name = name;
    this.handler = handler;
  }
}

export function createCommand(name: string, cb: (request: any, stream: any, token: vscode.CancellationToken) => Promise<void>): Command {
  return new Command(name, cb);
}

export function selectionCommand(name: string, choices: string[], cb: (out: string, stream: any) => void): Command {
  // Check the prompt for the selection
  return new Command(name, async (request, stream) => {
    let out = "";
    if (choices.indexOf(request.prompt) >= 0) {
      out = request.prompt;
    } else {
      out = await vscode.window.showQuickPick(choices) || "";
    }
    if (cb) {cb(out, stream);}
  });
}

export function inputCommand(name: string, prompt: string, value: string, cb: (out: string, stream: any) => void): Command {
  // Check the prompt for the selection
  const cmd = new Command(name, async (request, stream) => {
    let out = "";
    if (request.prompt) {
      out = request.prompt;
    } else {
      out = await vscode.window.showInputBox({ prompt, value }) || "";
    }
    if (cb) {cb(out, stream);}
  });
  return cmd;
}

export function showDocsCommand(name: string, fileName: string): Command {
  const cmd = new Command(name, async (_request: any, stream: any) => {
    // Resolve the file path to the markdown file
    const filePath = path.resolve(__dirname, "..", "docs", fileName);
    
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Read the file and send its content as markdown
      stream.markdown(fs.readFileSync(filePath, "utf-8"));
    } else {
      // Throw an error if the file doesn't exist
      throw new Error("Can't find that file: " + filePath);
    }
  });

  return cmd;
}

export default Command;