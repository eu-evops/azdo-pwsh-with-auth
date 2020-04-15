import ma = require('azure-pipelines-task-lib/mock-answer');
import mockRun = require('azure-pipelines-task-lib/mock-run');
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
answers.which!['docker'] = '/usr/local/bin/docker';

const tempDir = fs.mkdtempSync('azdotask-docker-registry-test');

answers.rmRF![path.join(tempDir, '.docker')] = {
  success: true
}

const taskCmd = `/usr/local/bin/pwsh -NoLogo -NoProfile -NonInteractive -Command . '${tempDir}/Run-AzdoScript.ps1'`
answers.exec![taskCmd] = <ma.TaskLibAnswerExecResult>{
  code: 1,
  stderr: '',
  stdout: 'My script has executed'
}

const dockerConfigPath = path.resolve(`${tempDir}/.docker`)

const loginCmd = `echo password | docker --config ${dockerConfigPath} login --username username --password-stdin registryUrl`
answers.exec![loginCmd] = <ma.TaskLibAnswerExecResult>{
  code: 0,
  stderr: '',
  stdout: "Successfully logged in"
}

const logout = `docker --config ${dockerConfigPath} logout registryUrl`
answers.exec![logout] = <ma.TaskLibAnswerExecResult>{
  code: 0,
  stderr: '',
  stdout: "Successfully logged out in"
}


tmr.setAnswers(answers);

const vars: { [key: string]: string } = {}
vars["agent.tempDirectory"] = tempDir;

tmr.registerMockExport('getVariable', (key: string) => {
  return vars[key];
})

tmr.setInput('script', "echo 1");
// tmr.setInput('connectedServiceNameARM', 'azdo')
tmr.setInput('dockerRegistryEndpoint', 'dockerRegistry')

process.env.AGENT_TEMPDIRECTORY=tempDir
process.env.ENDPOINT_URL_dockerRegistry="notRegistryUrl"
process.env.ENDPOINT_AUTH_dockerRegistry=`{"parameters":{"username":"username","password":"password","registry":"registryUrl"},"scheme":"UsernamePassword"}`
process.env.ENDPOINT_AUTH_SCHEME_dockerRegistry="UsernamePassword"
process.env.ENDPOINT_AUTH_PARAMETER_dockerRegistry_USERNAME="username"
process.env.ENDPOINT_AUTH_PARAMETER_dockerRegistry_PASSWORD="password"
process.env.ENDPOINT_AUTH_PARAMETER_dockerRegistry_REGISTRY="registryUrl"

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