import * as vscode from "vscode";

export default function registerCommand(ctx: vscode.ExtensionContext) {
  const dis = vscode.commands.registerCommand(
    "type-language.configuration.workspace",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window
        .showOpenDialog({
          title: "Please pick type-language workspace",
          canSelectMany: false,
          canSelectFolders: true,
          canSelectFiles: false,
        })
        .then((uris) => {
          if (uris) {
            console.log(uris[0].path);
            vscode.workspace
              .getConfiguration()
              .update("type-language.workspace", uris[0].path);
            vscode.window.showInformationMessage(
              "Type language workspace configure successful!"
            );
          }
        });
    }
  );
  ctx.subscriptions.push(dis);
}
