import ServiceConnection from '../ServiceConnection'
import path from 'path';
import fs from 'fs';
import tl = require('azure-pipelines-task-lib/task');
import util from 'util';

export default class DockerHostServiceConnection implements ServiceConnection {
  static CERTS_FOLDER = "docker-certs";
  workingFolder: string;
  endpointId: string;
  dockerCertsFolder: string
  
  constructor(workingFolder: string, endpointId: string) {
    this.workingFolder = workingFolder
    this.endpointId = endpointId
    this.dockerCertsFolder = path.join(this.workingFolder, DockerHostServiceConnection.CERTS_FOLDER);
  }

  async setupAuth(): Promise<void> {
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

    process.env.DOCKER_HOST = tl.getEndpointUrl(this.endpointId, false);
    process.env.DOCKER_TLS_VERIFY = "true"
    process.env.DOCKER_CERT_PATH = this.dockerCertsFolder;

    tl.debug(util.format('Setting DOCKER_HOST=%s', process.env.DOCKER_HOST));
    tl.debug(util.format('Setting DOCKER_TLS_VERIFY=%s', process.env.DOCKER_TLS_VERIFY));
    tl.debug(util.format('Setting DOCKER_CERT_PATH=%s', process.env.DOCKER_CERT_PATH));
  }

  async cleanupAuth(): Promise<void> {
    tl.rmRF(this.dockerCertsFolder);
  }
}