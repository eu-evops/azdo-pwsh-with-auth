import ServiceConnection, { SetupAuthResponse, ServiceConnectionBase } from '../ServiceConnection'
import path from 'path';
import fs from 'fs';
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import util from 'util';
import Registry from '../Library/Docker/Registry';

export default class DockerRegistryServiceConnection extends ServiceConnectionBase {
  static DOCKER_CONFIG_FOLDER: string = ".docker";
  workingFolder: string;
  endpointId: string;
  dockerConfigPath: string;
  successfullyLoggedIn: boolean = false;
  dockerRegistry: string | undefined;

  constructor(workingFolder: string, endpointId: string, env: { [key: string]: string } = {}) {
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

    if (!await Registry.validate(new URL(this.dockerRegistry), auth.parameters.username, auth.parameters.password, tl.getBoolInput("dockerRegistryIgnoreSSLErrors"), "v2")) {
      tl.setResult(tl.TaskResult.Failed, "Could not log in to Docker registry")
      throw "Docker Registry login error, please inspect the output"
    }

    this.successfullyLoggedIn = true;

    const dockerConfig = {
      auths: {
        [this.dockerRegistry]: {
          auth: Buffer.from(`${auth.parameters.username}:${auth.parameters.password}`).toString("base64")
        }
      }
    }
    const configFilePath = path.join(this.dockerConfigPath, "config.json")
    fs.writeFileSync(configFilePath, JSON.stringify(dockerConfig, null, 2))


    return <SetupAuthResponse>{
      scripts: [],
      environment: {
        DOCKER_CONFIG: this.dockerConfigPath
      }
    }
  }

  async cleanupAuth(): Promise<void> {
    if (!this.successfullyLoggedIn) {
      return console.log("Don't need to log out, we could not log in in the first place, please inspect the output")
    }

    console.log("Cleaning up Docker Registry authentication");
    if (this.dockerRegistry) {
      const docker = tl.tool('docker')
      docker.arg(['--config', this.dockerConfigPath, 'logout', this.dockerRegistry])
      const returnCode = await docker.exec()
      if (returnCode !== 0) {
        tl.setResult(tl.TaskResult.Failed, "Could not log out from Docker registry")
      }
    }
  }
}