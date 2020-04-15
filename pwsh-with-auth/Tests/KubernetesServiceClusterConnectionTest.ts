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

const tempDir = fs.mkdtempSync('azdotask-kubernetes-test');

answers.rmRF![path.join(tempDir, 'kubernetes')] = {
  success: true
}

const taskCmd = `/usr/local/bin/pwsh -NoLogo -NoProfile -NonInteractive -Command . '${tempDir}/Run-AzdoScript.ps1'`
answers.exec![taskCmd] = <ma.TaskLibAnswerExecResult>{
  code: 0,
  stderr: '',
  stdout: 'My script has executed'
}

tmr.setAnswers(answers);

const vars: { [key: string]: string } = {}
vars["agent.tempDirectory"] = tempDir;

tmr.registerMockExport('getVariable', (key: string) => {
  return vars[key];
})

tmr.setInput('script', "echo 1");
tmr.setInput('kubernetesHostEndpoint', 'kubernetesKubeConfig')

process.env.AGENT_TEMPDIRECTORY=tempDir
process.env.ENDPOINT_URL_kubernetesKubeConfig="https://kubernetesCluster"
process.env.ENDPOINT_DATA_kubernetesKubeConfig_AUTHORIZATIONTYPE="Kubeconfig"
process.env.ENDPOINT_AUTH_SCHEME_kubernetesKubeConfig="KubeConfig"
process.env.ENDPOINT_AUTH_DATA_PARAMETER_kubernetesKubeConfig_AUTHORIZATIONTYPE="ServiceAccount" // || "ServiceAccount"
process.env.ENDPOINT_AUTH_kubernetesKubeConfig=`{"parameters":{"serviceAccountCertificate":"Cert","apiToken":"Token"},"scheme":"Token"}`
process.env.ENDPOINT_AUTH_PARAMETER_kubernetesKubeConfig_KUBECONFIG="current-context: null\nclusters:\n  - name: server\n    cluster:\n      server: https://kubernetesCluster\n      certificate-authority-data: Cert"
process.env.ENDPOINT_AUTH_PARAMETER_kubernetesKubeConfig_CLUSTERCONTEXT="kubernetes"


tmr.run();