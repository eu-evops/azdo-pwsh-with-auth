import ServiceConnection, { SetupAuthResponse, ServiceConnectionBase } from '../ServiceConnection'
import path from 'path';
import fs from 'fs';
import tl = require('azure-pipelines-task-lib/task');
import util from 'util';

export default class DockerHostServiceConnection extends ServiceConnectionBase {
  static CERTS_FOLDER = "docker-certs";
  workingFolder: string;
  endpointId: string;
  dockerCertsFolder: string
  
  constructor(workingFolder: string, endpointId: string, env: {[key:string]: string}={}) {
    super(workingFolder, endpointId, env)
    this.workingFolder = workingFolder
    this.endpointId = endpointId
    this.dockerCertsFolder = path.join(this.workingFolder, DockerHostServiceConnection.CERTS_FOLDER);
  }

  async setupAuth(): Promise<SetupAuthResponse> {
    console.log("Got DockerHost service connection")

    const auth = tl.getEndpointAuthorization(this.endpointId, false)
    if (!auth) {
      throw new Error("Authentication not found for endpoint " + this.endpointId);
    }

    if(!fs.existsSync(this.dockerCertsFolder)) {
      fs.mkdirSync(this.dockerCertsFolder);
    }

    fs.writeFileSync(path.join(this.dockerCertsFolder, "ca.pem"), auth?.parameters.cacert);
    fs.writeFileSync(path.join(this.dockerCertsFolder, "cert.pem"), auth?.parameters.cert);
    fs.writeFileSync(path.join(this.dockerCertsFolder, "key.pem"), auth?.parameters.key);

    const dockerHost = tl.getEndpointUrl(this.endpointId, false);
    const dockerTlsVerify = "true"
    const dockerCertsFolder = this.dockerCertsFolder;

    tl.debug(util.format('Setting DOCKER_HOST=%s', dockerHost));
    tl.debug(util.format('Setting DOCKER_TLS_VERIFY=%s', dockerTlsVerify));
    tl.debug(util.format('Setting DOCKER_CERT_PATH=%s', dockerCertsFolder));

    return <SetupAuthResponse>{
      scripts: [],
      environment: {
        DOCKER_HOST: dockerHost,
        DOCKER_TLS_VERIFY: dockerTlsVerify,
        DOCKER_CERT_PATH: dockerCertsFolder
      }
    }
  }

  async cleanupAuth(): Promise<void> {
    console.log("Cleaning up Docker host authentication");
    tl.rmRF(this.dockerCertsFolder);
  }
}