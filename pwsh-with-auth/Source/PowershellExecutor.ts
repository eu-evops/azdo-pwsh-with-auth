import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import fs from 'fs';

export default class PowershellExecutor {
  script: string
  path: string
  env: {[key: string]: string}

  constructor(script: string, path: string, env: {[key: string]: string} = {}) {
    this.script = script;
    this.path = path
    this.env = env
  }

  async run(): Promise<void> {
    fs.writeFileSync(this.path, this.script, { encoding: 'utf8' });

    console.log('========================== Starting Command Output ===========================');
    let powershell = tl.tool(tl.which('pwsh') || tl.which('powershell') || tl.which('pwsh', true))
        .arg('-NoLogo')
        .arg('-NoProfile')
        .arg('-NonInteractive')
        .arg('-Command')
        .arg(`. '${this.path.replace("'", "''")}'`);
      
      let options = <tr.IExecOptions>{
        failOnStdErr: false,
        errStream: process.stderr,
        outStream: process.stdout,
        ignoreReturnCode: true,
        env: {
          ...this.env,
          ...process.env
        },
    };

    let exitCode: number = await powershell.exec(options);
    // Fail on exit code.
    if (exitCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, "Powershell exited with non-0 exit code");
    }
  }
}