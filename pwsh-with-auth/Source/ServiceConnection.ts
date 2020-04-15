import { PathLike } from "fs";

export interface SetupAuthResponse {
  scripts: Array<PathLike>,
  environment: {[key:string]: string}
}

export type ServiceConnectionConstructor = {
  new (workingFolder: string, endpointId: string, env: {[key:string]: string}): ServiceConnection
};

export default interface ServiceConnection {
  setupAuth(): Promise<SetupAuthResponse> ;
  cleanupAuth(): Promise<void>;
}

export abstract class ServiceConnectionBase implements ServiceConnection {
  protected workingFolder: string;
  protected endpointId: string;
  protected env: { [key: string]: string; };
  
  setupAuth(): Promise<SetupAuthResponse> {
    throw new Error("Method not implemented.");
  }
  cleanupAuth(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  constructor(workingFolder: string, endpointId: string, env:{[key:string]: string} = {}) {
    this.workingFolder = workingFolder
    this.endpointId = endpointId
    this.env = env
  }
}