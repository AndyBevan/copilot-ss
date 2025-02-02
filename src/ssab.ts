import Participant from "./Participant";
import DB from "./db";
import * as vscode from "vscode";
import * as Command from "./Command";
import * as Editor from "./Editor";

export class SSAB extends Participant {
  private db: DB | null;
  private conn: string;
  public outputFormat: string;
  public queryResults: any[];
  private error: string;
  private errorQuery: string;
  private databaseType: string;

  //private myCommand: Command;
  constructor() {
    super({});
    

    // Sets the contextual response for Copilot
    this.db = null;
    this.databaseType = "";
    this.conn = Editor.getDotEnvValue("DATABASE_URL") || "TODO - what to do as a default";//"????????defalt sql server connection string goes here????????";
    // Sets the connection and our database, but doesn't check if it's valid ()
    this.setDb();

    this.outputFormat = "json";
    // This is the fenced codeblock indicator we want
    // so we can run code
    this.codeTag = "sql";
    this.queryResults = [];
    this.error = "";
    this.errorQuery = "";
    

    this.systemPrompt = `You are a friendly database administrator and you have been asked to help write SQL for a ${this.databaseType} database.`;

    // The individual /commands, set below
    this.setCommands();

    // When the response comes back, we'll have some code to parse
    this.on("sent", ({ stream }) => {
      if (this.codeblocks && this.codeblocks.length > 0) {
        stream.markdown("\n\n💃 I can run these for you. Just click the button below");
        stream.button({
          command: "ssab.run",
          title: vscode.l10n.t('Run This')
        });
        stream.button({
          command: "ssab.print",
          title: vscode.l10n.t('Edit the SQL')
        });
      }
    });
  }

  async defaultResponse(request: any, stream: any, token: vscode.CancellationToken): Promise<string>  {
    try {
      const schema = await this.db?.getSchema();
      const prompt = `Please provide help with ${request.prompt}. The reference database schema for question is ${schema}. IMPORTANT: Be sure you only use the tables and columns from this schema in your answer.`;
      return await this.send(prompt, stream, token);
    } catch (err) {
      stream.markdown("🤔 I can't find the schema for the database. Please check the connection string with `/conn`");
      return "Schema not found";
    }
  }

  private setDb() {
    if (this.db) {this.db.close();}
    if (this.conn) {this.db = new DB(this.conn);}
    if (this.db) {this.databaseType = this.db.databaseType;}
  }

  private async setCommands() {
    this.commands.out = Command.selectionCommand("out", ["json", "csv", "text"], (format: string) => {
      this.outputFormat = format;
      this.emit("report");
    });

    this.commands.fix = Command.createCommand("fix", async (request: any, stream: any, token: vscode.CancellationToken) => {
      if (this.error && this.errorQuery) {
        const schema = await this.db?.getSchema();
        const prompt = `I have a problem with this query: ${this.errorQuery} and the exact error is ${this.error}. How can I fix this for PostgreSQL? Be as complete as you can and make sure your answer complies with the schema: ${schema}`;
        await this.send(prompt, stream, token);
        this.emit("sent", { stream });
      } else {
        stream.markdown("🤔 I don't have an error to fix. Run some SQL first!");
      }
    });

    this.commands.schema = Command.createCommand("schema", async (request: any, stream: any, token: vscode.CancellationToken) => {
      const schema = await this.db?.getSchema();
      const prompt = `You are a savvy Postgres developer tasked with helping me create the tables and views for my database. Enhance the current schema with tables and views described by "${request.prompt.trim()}". Each table should have a primary key called 'id' that is serial primary key, and have created_at and updated_at fields that are timestamps defaulting to now in the current time zone. Each table and view should enhance and extend this schema: ${schema}`;
      await this.send(prompt, stream, token);
      this.emit("sent", { stream });
    });

    this.commands.conn = Command.createCommand("conn", async (request: any, stream: any) => {
      const prompt = request.prompt.trim();
      if (prompt.length > 0) {
        if (prompt.toLowerCase().startsWith("server=")) {
          this.conn = prompt;
        } else {
          //The postgres version supported something like this - I couln't find an equivalent for sql server that would work
          //this.conn = `postgres://localhost/${prompt}`;
          stream.markdown("Unable to set connection string. Please use the format `Server=localhost;Database=<dbName>;User Id=<myUser>;Password=<myPw>;Encrypt=false;`");
          return;
        }
        this.setDb();
        stream.markdown("🔗 Connection string set to `" + this.conn + "` .You can now run queries against the database");
      } else {
        stream.markdown(
          "🔗 The current connection is `" +
            this.conn +
            "` . You can change it by appending the new connection after /conn. Tip: you can use the name of the database only to connect to your local service. Otherwise, use a full URL like `postgres://localhost/mydb`"
        );
      }
    });

    this.commands.help = Command.showDocsCommand("help", "help.md");

    this.commands.show = Command.createCommand("show", async (request: any, stream: any) => {
      const prompt = request.prompt.trim();
      if (this.conn) {
        try {
          let md: string[] = ["```json"];
          if (prompt === "tables" || prompt.trim() === "") {
            let tables = await this.db?.getTableList();
            stream.markdown("Here are the tables in the database. You can ask for details about any table using `show [table]`.\n");
            tables?.forEach((t: any) => md.push(t.table_name));
            md.push("```");
            stream.markdown(md.join("\n"));
          } else {
            const table = await this.db?.getTable(prompt);
            if (table) {
              stream.markdown("Here are details for `" + prompt + "`\n");
              md.push(table);
              md.push("```");
              stream.markdown(md.join("\n"));
            } else {
              stream.markdown("🧐 Can't find the table `" + prompt + "` \n");
            }
          }
        } catch (err) {
          console.error("ERROR", err);
          stream.markdown(
            "\n\n🤷🏻‍♀️ There is a problem connecting to the database using `" +
              this.conn +
              "`. This could be due to a connection issue, or that you don't have permission to query the tables. You can change the connection using `/conn.`"
          );
        }
      } else {
        stream.markdown("🤔 Make sure the connection is set with `/conn` and you pass a table name");
      }
    });

    this.emit("commands-set");
  }

  async run() {
    if (this.codeblocks.length === 0) {return [];}
    try {
      this.queryResults.length = 0;
      for (let sql of this.codeblocks) {
        const res = await this.db?.run(sql);
        if (res && res.length > 0) {
          this.queryResults.push(res);
        }
      }
      if (this.queryResults.length === 1) {this.queryResults = this.queryResults[0];}
      this.emit("report");
    } catch (err: any) {
      const sql = this.codeblocks.join("\n\n");
      this.error = err.message;
      this.errorQuery = sql;
      const message = `/*
  Looks like there's a SQL problem: ${err.message}. 
  Copilot does its best but sometimes needs a little help!
  You can fix the problem on your own, or try @pg /fix to see what Copilot has to say. Click the 'Run This' button to execute again.
  */
      
  ${sql}
  `;
      this.emit("query-error", message);
    }
  }
}

export default SSAB;