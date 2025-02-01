// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import SSAB from "./ssab";
import * as Editor from "./Editor";
import * as converter from "json-2-csv";

export async function activate(context: vscode.ExtensionContext) {
  //this is our chat participant
  const ssab = new SSAB();

  //wire up events coming from the participant
  ssab.on("report", async function() {
    if (ssab.outputFormat === "csv") {
      //const converter = require('json-2-csv');
      const csv = converter.json2csv(ssab.queryResults);
      Editor.writeAndShowFile("results.csv", csv);
    } else {
      const json = JSON.stringify(ssab.queryResults, null, 2);
      if (ssab.queryResults.length === 0) {
        vscode.window.showInformationMessage("Query executed successfully with no results");
      } else {
        Editor.writeAndShowFile("results.json", json);
      }
    }
  });

  //handle the query error by showing the SQL in a file.
  ssab.on("query-error", async function(message: string) {
    Editor.writeAndShowFile("query.sql", message);
  });

  //it's important to use an inline callback here due to scoping issues.
  //setting the handler to ssab.handle would not work as "this" would not
  //be set right.
  const participant = vscode.chat.createChatParticipant("dba.ssab", async (request: any, context: any, 
    stream: any, token: vscode.CancellationToken) => {
    //Whenever a user hits enter, this is where we'll send the request
    await ssab.handle(request, context, stream, token);
  });

  context.subscriptions.push(
    participant,
    vscode.commands.registerCommand("ssab.print", async () => {
      const sql = ssab.codeblocks.join("\n");
      const out = `/*
Edit the SQL below and click 'Run This' to execute the query. You can change the file as much as you like, and if there's an error, you'll see it here in the file
*/

`;
      Editor.writeAndShowFile("query.sql", out + sql);
    }),
    vscode.commands.registerCommand("ssab.run", async () => {
      if (Editor.currentFileNameIs("query.sql")) {
        // This is what we're going to run, replace our current command
        const sql = Editor.readCurrentEditor();
        if (sql) {
          ssab.codeblocks.length = 0;
          ssab.codeblocks.push(sql);
        }
      }
      await ssab.run();
    })
  );

  
}

// This method is called when your extension is deactivated
export async function deactivate(): Promise<void> {
	// Clean-up logic (if necessary)
  }