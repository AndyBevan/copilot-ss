// The module helps work with the VS Code editor and file system.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as dotenv from "dotenv";

const workspaceDir = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
const tempDir = path.join(__dirname, "../", "temp");

// A wrapper for writing and showing a file
export function writeAndShowFile(fileName: string, content: string): void {
  saveTempFile(fileName, content);
  openTempFile(fileName);
}

export async function writeAndShowFileAsync(fileName: string, content: string): Promise<vscode.TextEditor> {
  saveTempFile(fileName, content);
  return openTempFileAsync(fileName);
}

// Temp files exist in the extension directory, in the temp folder.
export function saveTempFile(fileName: string, content: string): void {
  // Just in case
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const filePath = path.resolve(tempDir, fileName);
  fs.writeFileSync(filePath, content, "utf-8");
}

export function openTempFile(fileName: string): void {
  const filePath = path.resolve(tempDir, fileName);
  const openPath = vscode.Uri.file(filePath);
  vscode.workspace.openTextDocument(openPath).then(doc => {
    vscode.window.showTextDocument(doc);
  });
}

export async function openTempFileAsync(fileName: string): Promise<vscode.TextEditor> {
  const filePath = path.resolve(tempDir, fileName);
  const openPath = vscode.Uri.file(filePath);
  return vscode.workspace.openTextDocument(openPath).then(doc => {
      // When the document is opened, show it in the editor
      return vscode.window.showTextDocument(doc);
  });
}

export async function closeActiveWindowAsync(): Promise<void> {
  if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  }
}

export function currentFileNameIs(fileName: string): boolean {
  const tempFile = path.resolve(tempDir, fileName);
  if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    // This is *unsaved* text
    return vscode.window.activeTextEditor.document.fileName === tempFile;
  }
  return false;
}

export function readCurrentEditor(): string | null {
    // Make sure there's an open editor
    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
      // This is *unsaved* text
      return vscode.window.activeTextEditor.document.getText();
    }
    return null;
  }
  
  // Careful with this one - we *do not* want to grab an ENV setting
  // from the user's machine. This is for the .env file in the workspace
  // DATABASE_URL could be set to anything, even prod somewhere!
  export function getDotEnvValue(key: string): string | undefined {
    const envFile = path.resolve(workspaceDir, ".env");
    console.log("ENV path", envFile);
    // There's an issue here on Windows
    const env = dotenv.config({ path: `${envFile}` });
    return env.parsed ? env.parsed[key] : undefined;
  }