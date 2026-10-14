import { execFile } from "node:child_process";
import { promisify } from "node:util";

// execFile runs a program, but it uses old-style callbacks.
// promisify lets us use it with await instead.
const execFileAsync = promisify(execFile);

// Run a program (for example ffprobe or ffmpeg), wait for it to finish, and return what it printed.
// Throws if the program fails or takes longer than `timeoutMs`.
export async function runProgram(program: string, args: string[], timeoutMs: number): Promise<string> {
  const { stdout } = await execFileAsync(program, args, { timeout: timeoutMs });
  return stdout;
}
