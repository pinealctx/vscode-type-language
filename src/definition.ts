import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

class TLDefinitionProvider implements vscode.DefinitionProvider {
  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);
    const line = document.lineAt(position);

    // catch comment or split chars word
    if (/^(\/\/|---)/.test(line.text)) {
      return null;
    }

    // catch base type word
    if (baseTypes.indexOf(word) !== -1) {
      return null;
    }

    // catch is not type word
    if (
      !isType(
        line.text,
        word,
        wordRange.start.character,
        wordRange.end.character
      )
    ) {
      return null;
    }

    const filename = document.fileName;
    let workspace = <string>(
      vscode.workspace.getConfiguration().get("type-language.workspace")
    );
    if (
      !workspace ||
      !fs.existsSync(workspace) ||
      !fs.statSync(workspace).isDirectory() ||
      !checkFileInDir(path.basename(filename), workspace)
    ) {
      workspace = path.dirname(filename);
    }

    let dist: vscode.Location[] = [];
    const files = readTLFiles(workspace);
    for (let i = 0; i < files.length; i++) {
      dist = dist.concat(parseFile(files[i], word));
    }
    return dist;
  }
}

const baseTypes = [
  "#",
  "int",
  "int128",
  "long",
  "Bool",
  "bool",
  "true",
  "false",
  "bytes",
  "vector",
  "Vector",
  "string",
  "X",
  "!X",
];

function parseLineType(
  line: string
): { type: string; start: number; end: number }[] {
  const dist: { type: string; start: number; end: number }[] = [];
  const m = line.match(/= (.*?);/);
  if (m) {
    let type = m[1];
    let start = m.index! + 2;
    const end = line.indexOf(";");
    const index = m[1].indexOf(".");
    if (index !== -1) {
      type = m[1].split(".")[1];
      start += 1 + index;
    }
    dist.push({ type, start, end });
  }
  const matches = line.matchAll(
    /:([vV]ector<(.*?)>|flags.\d\?(Vector<(.*?)>|(.*?))|(.*?))(?: )/g
  );
  while (true) {
    const match = matches.next();
    if (match.done) {
      break;
    }
    const value = match.value;
    let type: string = "";
    for (let i = 0; i < value.length; i++) {
      type = value[i] || type;
    }

    const start = value.index! + value[0].lastIndexOf(type);
    dist.push({
      type,
      start,
      end: start + type.length,
    });
  }
  return dist;
}

function isType(
  line: string,
  word: string,
  start: number,
  end: number
): boolean {
  const list = parseLineType(line);
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item.type === word && start === item.start && end === item.end) {
      return true;
    }
  }
  return false;
}

function parseFile(filename: string, type: string): vscode.Location[] {
  const list: vscode.Location[] = [];
  const lines = fs.readFileSync(filename).toString().split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() && !/^(\/\/|---)/.test(line)) {
      const types = parseLineType(line);
      for (let j = 0; j < types.length; j++) {
        if (types[j].type === type) {
          list.push(
            new vscode.Location(
              vscode.Uri.file(filename),
              new vscode.Range(
                new vscode.Position(i, types[j].start),
                new vscode.Position(i, types[j].end)
              )
            )
          );
        }
      }
    }
  }
  return list;
}

const ignoreDirs = [".git", ".idea", "node_modules"];

function readTLFiles(dir: string): string[] {
  const filenames = fs.readdirSync(dir);
  let dist: string[] = [];
  for (let i = 0; i < filenames.length; i++) {
    const filename = filenames[i];
    const filepath = path.join(dir, filename);
    const fileStat = fs.statSync(filepath);
    if (fileStat.isFile() && path.extname(filename) === ".tl") {
      dist.push(filepath);
      continue;
    }
    if (fileStat.isDirectory() && !ignoreDirs.includes(filename)) {
      dist = dist.concat(readTLFiles(filepath));
    }
  }
  return dist;
}

function checkFileInDir(inDir: string, outDir: string): boolean {
  const inDirs = inDir.split("/");
  const outDirs = outDir.split("/");
  if (outDirs.length > inDirs.length) {
    return false;
  }
  for (let i = 0; i < outDirs.length; i++) {
    if (inDirs[i] !== outDirs[i]) {
      return false;
    }
  }
  return true;
}

export default function registerDefinitionProvider(
  ctx: vscode.ExtensionContext
) {
  const dis = vscode.languages.registerDefinitionProvider(
    { scheme: "file", language: "typelanguage" },
    new TLDefinitionProvider()
  );
  ctx.subscriptions.push(dis);
}
