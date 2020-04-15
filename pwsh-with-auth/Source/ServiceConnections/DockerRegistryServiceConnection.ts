import ServiceConnection, { SetupAuthResponse, ServiceConnectionBase } from '../ServiceConnection'
import path from 'path';
import fs from 'fs';
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import util from 'util';

export default class DockerRegistryServiceConnection extends ServiceConnectionBase {
  static DOCKER_CONFIG_FOLDER: string = ".docker";
  workingFolder: string;
  endpointId: string;
  dockerConfigPath: string;
  dockerRegistry: string | undefined;
  
  constructor(workingFolder: string, endpointId: string, env: {[key:string]: string}={}) {
    super(workingFolder, endpointId, env)
    this.workingFolder = workingFolder
    this.endpointId = endpointId
    this.dockerConfigPath = path.resolve(path.join(workingFolder, DockerRegistryServiceConnection.DOCKER_CONFIG_FOLDER));
  }
  
  async setupAuth(): Promise<SetupAuthResponse> {
    console.log("Got DockerRegistry service connection")
    
    const auth = tl.getEndpointAuthorization(this.endpointId, false)
    if (!auth) {
      throw new Error("Authentication not found for endpoint " + this.endpointId);
    }

    if (!fs.existsSync(this.dockerConfigPath)) {
      fs.mkdirSync(this.dockerConfigPath);
    }

    this.dockerRegistry = auth.parameters.registry;
    
    tl.debug(util.format('Setting DOCKER_CONFIG=%s', this.dockerConfigPath));

    const docker = tl.tool('docker')

    docker.arg(['--config', this.dockerConfigPath, 'login', '--username', auth!.parameters.username, '--password-stdin', this.dockerRegistry])


    const passwordEcho = tl.tool('echo')
    passwordEcho.arg(auth.parameters.password)
    passwordEcho.pipeExecOutputToTool(docker)

    const dockerLoginResult = await passwordEcho.exec()
    if (dockerLoginResult !== 0) {
      tl.setResult(tl.TaskResult.Failed, "Could not log out from Docker registry")
      throw "Docker Registry login error, please inspect the output"
    }

    return <SetupAuthResponse>{
      scripts: [],
      environment: {
        DOCKER_CONFIG: this.dockerConfigPath
      }
    }
  }

  async cleanupAuth(): Promise<void> {
    console.log("Cleaning up Docker Registry authentication");
    if (this.dockerRegistry) {
      const docker = tl.tool('docker')
      docker.arg(['--config', this.dockerConfigPath, 'logout', this.dockerRegistry])
      const returnCode = await docker.exec()
      if(returnCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, "Could not log out from Docker registry")
      }
    }
  }
}