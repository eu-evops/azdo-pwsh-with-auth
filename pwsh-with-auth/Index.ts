import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import path = require('path');
import util = require('util');
import ServiceConnection, { ServiceConnectionBase, ServiceConnectionConstructor } from './Source/ServiceConnection';
import DockerHostServiceConnection from './Source/ServiceConnections/DockerHostServiceConnection';
import AzureServiceConnection from './Source/ServiceConnections/AzureServiceConnection';
import PowershellExecutor from './Source/PowershellExecutor';
import { PathLike } from 'fs';
import KubernetesHostServiceConnection from './Source/ServiceConnections/KubernetesHostServiceConnection';
import DockerRegistryServiceConnection from './Source/ServiceConnections/DockerRegistryServiceConnection';

interface Hash<T> {
    [key: string]: T
}

const supportedEndpoints:Hash<ServiceConnectionConstructor> = {
    connectedServiceNameARM: AzureServiceConnection,
    dockerHostEndpoint: DockerHostServiceConnection,
    dockerRegistryEndpoint: DockerRegistryServiceConnection,
    kubernetesHostEndpoint: KubernetesHostServiceConnection
}

function getProxyUri(): tl.ProxyConfiguration | null {
    return tl.getHttpProxyConfiguration();
}

async function run() {
    tl.setResourcePath(path.join( __dirname, 'task.json'));
    
    const serviceConnections: Array<ServiceConnection> = new Array<ServiceConnection>();
    
    try {
        let tempDirectory = tl.getVariable('agent.tempDirectory');
        
        if (!tempDirectory) {
            tl.setResult(tl.TaskResult.Failed, "Agent Temp directory not defined")
            return;
        }
        
        tl.debug(util.format("taskWorkingFolder=%s", tempDirectory));

        const scripts: Array<PathLike> = []
        const environment: {[key:string]: string} = {}

        Object.keys(supportedEndpoints).forEach(key => {
            const endpointId = tl.getInput(key);
            if (endpointId) {
                const service = new supportedEndpoints[key](tempDirectory!, endpointId, environment);
                serviceConnections.push(service);
            }
        })

        let filePath = path.join(tempDirectory, 'Run-AzdoScript.ps1');

        tl.debug('Reading script input')
        const inputScript = tl.getInput("script");

        tl.debug(util.format("Input script: %s", inputScript));

        let proxyConfiguration = getProxyUri();
        if(proxyConfiguration) {
            environment.HTTP_PROXY=proxyConfiguration.proxyUrl;
            environment.HTTPS_PROXY=proxyConfiguration.proxyUrl;
        }

        for(let i=0; i<serviceConnections.length; i++) {
            const setupAuthResponse = await serviceConnections[i].setupAuth();
            
            setupAuthResponse.scripts.forEach(script => {
                scripts.push(script);
            })
            
            Object.assign(environment, setupAuthResponse.environment);
        }

        let script = `$ErrorActionPreference = "Stop";\n`;
        script += `$ProgressPreference = "SilentlyContinue";\n`;
        script += `\n`;
        
        scripts.forEach(s => {
            script += `${s}\n`
            script += "# Removing script so that credentials don't leak into underlying execution\n"
            script += `Remove-Item -Force ${s}\n`
        });
        
        script += `\n`;

        script += inputScript;

        const executor = new PowershellExecutor(script, filePath, environment);
        await executor.run();

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    } finally {
        for(let i=serviceConnections.length - 1; i>=0; i-=1) {
            await serviceConnections[i].cleanupAuth();
        }
    }
}

run();