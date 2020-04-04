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
answers.which!['pwsh'] = '/usr/local/bin/pwsh';

const tempDir = fs.mkdtempSync('azdotask-docker-test');

const taskCmd = `/usr/local/bin/pwsh -NoLogo -NoProfile -NonInteractive -Command . '${tempDir}/Run-AzdoScript.ps1'`
answers.exec![taskCmd] = <ma.TaskLibAnswerExecResult>{
  code: 1,
  stderr: '',
  stdout: 'My script has executed'
}

answers.rmRF![path.join(tempDir, 'docker-certs')] = {
  success: true
}

tmr.setAnswers(answers);

const vars: { [key: string]: string } = {}
vars["agent.tempDirectory"] = tempDir;

tmr.registerMockExport('getVariable', (key: string) => {
  return vars[key];
})

tmr.setInput('script', "echo 1");
// tmr.setInput('connectedServiceNameARM', 'azdo')
tmr.setInput('dockerHostEndpoint', 'docker')

process.env.AGENT_TEMPDIRECTORY=tempDir
process.env.ENDPOINT_URL_docker="tcp://docker"
process.env.ENDPOINT_AUTH_docker=`{"parameters":{"cacert":"CaCert","cert":"Cert","key":"Key"},"scheme":"Certificate"}`
process.env.ENDPOINT_AUTH_SCHEME_docker="Certificate"
process.env.ENDPOINT_AUTH_PARAMETER_docker_CACERT="CaCert"
process.env.ENDPOINT_AUTH_PARAMETER_docker_CERT="Cert"
process.env.ENDPOINT_AUTH_PARAMETER_docker_KEY="Key"

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