import ma = require('azure-pipelines-task-lib/mock-answer');
import mockRun = require('azure-pipelines-task-lib/mock-run');
import mockTest = require('azure-pipelines-task-lib/mock-test');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'Index.js');
let tmr: mockRun.TaskMockRunner = new mockRun.TaskMockRunner(taskPath);

let answers = <ma.TaskLibAnswers> {
  checkPath: { },
  find: { },
  exec: {},
  rmRF: { },
  which: { }
};
answers.checkPath!['asdf'] = true
answers.which!['pwsh'] = '/usr/local/bin/pwsh';

const tempDir = fs.mkdtempSync('azdotask-azure-test');

const loginCmd = `/usr/local/bin/pwsh -NoLogo -NoProfile -NonInteractive -Command . '${tempDir}/Connect-Azure.ps1'`
answers.exec![loginCmd] = <ma.TaskLibAnswerExecResult>{
  code: 0,
  stderr: '',
  stdout: 'Successfully Logged in to Azure'
}

const logoutCmd = `/usr/local/bin/pwsh -NoLogo -NoProfile -NonInteractive -Command . '${tempDir}/Disconnect-Azure.ps1'`
answers.exec![logoutCmd] = <ma.TaskLibAnswerExecResult>{
  code: 0,
  stderr: '',
  stdout: 'Successfully logged out of Azure'
}

const taskCmd = `/usr/local/bin/pwsh -NoLogo -NoProfile -NonInteractive -Command . '${tempDir}/Run-AzdoScript.ps1'`
answers.exec![taskCmd] = <ma.TaskLibAnswerExecResult>{
  code: 1,
  stderr: '',
  stdout: 'My script has executed'
}


tmr.setAnswers(answers);

const vars: { [key: string]: string } = {}
vars["agent.tempDirectory"] = tempDir;

tmr.registerMockExport('getVariable', (key: string) => {
  return vars[key];
})

tmr.registerMockExport('getEndpointAuthorization', (key:string, val: any) => {
  // throw key;
})

tmr.setInput('script', "echo 1");
tmr.setInput('connectedServiceNameARM', 'azdo')
// tmr.setInput('dockerHostEndpoint', 'docker')

process.env.ENDPOINT_URL_azdo="https://azure"
process.env.ENDPOINT_AUTH_azdo="{}"
process.env.ENDPOINT_AUTH_SCHEME_azdo="ServicePrincipal"
process.env.ENDPOINT_AUTH_PARAMETER_azdo_TENANTID="ServicePrincipal"
process.env.ENDPOINT_AUTH_PARAMETER_azdo_SERVICEPRINCIPALID="ServicePrincipal"
process.env.ENDPOINT_AUTH_PARAMETER_azdo_AUTHENTICATIONTYPE="ServicePrincipal"
process.env.ENDPOINT_AUTH_PARAMETER_azdo_SERVICEPRINCIPALKEY="ServicePrincipal"

tmr.run();

// console.log("Cleaning up after tests...")

// function removeFolder(folderPath:fs.PathLike) {
//   const folderInfo = fs.statSync(folderPath);

//   if(!folderInfo.isDirectory()) {
//     console.log("The path is not a folder, aborting: %s", folderPath);
//     return;
//   }

//   const entries = fs.readdirSync(folderPath);
//   entries.forEach(entry => {
//     const fullPath = path.join(folderPath.toString(), entry);
//     const entryStat = fs.statSync(fullPath);
//     if(entryStat.isDirectory()) {
//       removeFolder(fullPath);
//     } else {
//       fs.unlinkSync(fullPath);
//     }
//   });
//   fs.rmdirSync(folderPath);
// }
// removeFolder(tempDir);