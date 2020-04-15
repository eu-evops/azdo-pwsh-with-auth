import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as shared from './TestShared';
import 'jest-extended';
import * as fs from 'fs';

describe('Powershell with Authentication Suite', function() {
    const foldersToClear: Array<fs.PathLike> = [];

    beforeEach(async () => {
        foldersToClear.splice(0);
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
    });

    afterEach(async function() {
        foldersToClear.forEach(folder => {
            tl.rmRF(folder.toString());
        })
    });

    function getWorkingFolder(output:string) {
        const workingFolderRegexMatch = output.match("##vso\\[task.debug\\]taskWorkingFolder=(.*)");
        
        expect(workingFolderRegexMatch).toBeTruthy()
        const wf = workingFolderRegexMatch![1];
        foldersToClear.push(wf);

        return wf;
    }
    
    function extractFromLog(output:string, key:string) {
        const match = output.match(`##vso\\[task.debug\\]${key}=(.*)`);
        return match![1];
    }

    it('should report the location of a working folder', async () => {
        let tp = path.join(__dirname, 'AzureServiceTest.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.run();

        getWorkingFolder(tr.stdout);
    });

    describe('Azure', function() {
        it('Runs successfully for Azure', (done) => {
            let tp = path.join(__dirname, 'AzureServiceTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            const wf = getWorkingFolder(tr.stdout);

            expect(tr.invokedToolCount).toBe(2);
            expect(tr.stderr).toBeEmpty();
            expect(tr.errorIssues).toBeEmpty();
            expect(tr.succeeded).toBeTrue();

            expect(tr.stdout).toContain("Run-AzdoScript.ps1")

            const connectAzureScript = fs.readFileSync(path.join(wf, 'Connect-Azure.ps1')).toString();
            expect(connectAzureScript).toContain("-Scope Process")

            const azdoScript = fs.readFileSync(path.join(wf, 'Run-AzdoScript.ps1')).toString();

            expect(azdoScript).toContain("Connect-Azure.ps1");
            expect(azdoScript).toMatch(/Remove-Item -Force.*Connect-Azure.ps1/);
            expect(azdoScript).toContain("echo 1");
            expect(tr.stdout).toContain("Disconnect-Azure.ps1")

            done();
        });


        it('Clears up even if the task fails', (done) => {
            let tp = path.join(__dirname, 'AzureServiceFailingTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            getWorkingFolder(tr.stdout);

            expect(tr.invokedToolCount).toBe(2);
            expect(tr.stderr).toBeEmpty();
            expect(tr.errorIssues).not.toBeEmpty();
            expect(tr.failed).toBeTrue();

            expect(tr.stdout).toContain("Run-AzdoScript.ps1")
            expect(tr.stdout).toContain("Disconnect-Azure.ps1")

            done();
        });
    })

    describe('Docker', function() {
        it('Runs successfully for Docker', (done) => {
            let tp = path.join(__dirname, 'DockerServiceTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            const workingFolder = getWorkingFolder(tr.stdout);

            expect(tr.invokedToolCount).toBe(1);
            expect(tr.stderr).toBeEmpty();
            expect(tr.errorIssues).toBeEmpty();
            expect(tr.succeeded).toBeTrue();

            expect(extractFromLog(tr.stdout, "Setting DOCKER_CERT_PATH")).toBe(path.join(workingFolder, "docker-certs"))
            expect(extractFromLog(tr.stdout, "Setting DOCKER_HOST")).toBe("tcp://docker")
            expect(extractFromLog(tr.stdout, "Setting DOCKER_TLS_VERIFY")).toBe("true")

            expect(fs.readFileSync(path.join(workingFolder, "docker-certs", "ca.pem")).toString()).toBe("CaCert")
            expect(fs.readFileSync(path.join(workingFolder, "docker-certs", "cert.pem")).toString()).toBe("Cert")
            expect(fs.readFileSync(path.join(workingFolder, "docker-certs", "key.pem")).toString()).toBe("Key")

            done();
        });

        it('Clears up even if the task fails', (done) => {
            let tp = path.join(__dirname, 'DockerServiceFailingTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            const workingFolder = getWorkingFolder(tr.stdout);

            expect(tr.invokedToolCount).toBe(1);
            expect(tr.stderr).toBeEmpty();
            expect(tr.errorIssues).not.toBeEmpty();
            expect(tr.failed).toBeTrue();

            expect(extractFromLog(tr.stdout, "Setting DOCKER_CERT_PATH")).toBe(path.join(workingFolder, "docker-certs"))
            expect(extractFromLog(tr.stdout, "Setting DOCKER_HOST")).toBe("tcp://docker")
            expect(extractFromLog(tr.stdout, "Setting DOCKER_TLS_VERIFY")).toBe("true")

            expect(fs.readFileSync(path.join(workingFolder, "docker-certs", "ca.pem")).toString()).toBe("CaCert")
            expect(fs.readFileSync(path.join(workingFolder, "docker-certs", "cert.pem")).toString()).toBe("Cert")
            expect(fs.readFileSync(path.join(workingFolder, "docker-certs", "key.pem")).toString()).toBe("Key")

            done();
        });
    })

    describe('Kubernetes', () => {
        it('Runs successfully for Kubernetes ServiceConnection', (done) => {
            let tp = path.join(__dirname, 'KubernetesServiceTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            const workingFolder = getWorkingFolder(tr.stdout);

            expect(tr.invokedToolCount).toBe(1);
            expect(tr.stderr).toBeEmpty();
            expect(tr.errorIssues).toBeEmpty();
            expect(tr.succeeded).toBeTrue();

            const kubeconf = fs.readFileSync(path.join(workingFolder, "kubernetes", "config")).toString()

            expect(kubeconf).toContain("https://kubernetes")
            expect(kubeconf).toContain("Cert")
            expect(kubeconf).toContain("ApiToken")

            done();
        });
        it('Runs successfully for Kubernetes Cluster Config', (done) => {
            let tp = path.join(__dirname, 'KubernetesServiceClusterConnectionTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            const workingFolder = getWorkingFolder(tr.stdout);

            expect(tr.invokedToolCount).toBe(1);
            expect(tr.stderr).toBeEmpty();
            expect(tr.errorIssues).toBeEmpty();
            expect(tr.succeeded).toBeTrue();

            const kubeconf = fs.readFileSync(path.join(workingFolder, "kubernetes", "config")).toString()

            expect(kubeconf).toContain("https://kubernetesCluster")
            expect(kubeconf).toContain("Cert")

            done();
        });
        it('Clears up even if the task fails', (done) => {
            let tp = path.join(__dirname, 'KubernetesServiceFailingTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            const workingFolder = getWorkingFolder(tr.stdout);

            expect(tr.invokedToolCount).toBe(1);
            expect(tr.stderr).toBeEmpty();
            expect(tr.errorIssues).not.toBeEmpty();
            expect(tr.failed).toBeTrue();

            const kubeconf = fs.readFileSync(path.join(workingFolder, "kubernetes", "config")).toString()

            expect(kubeconf).toContain("https://kubernetes")
            expect(kubeconf).toContain("Cert")
            expect(kubeconf).toContain("ApiToken")

            done();
        });
    })


    describe('Docker Registry', function() {
        it('Runs successfully for Docker Registry', (done) => {
            let tp = path.join(__dirname, 'DockerRegistryServiceTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            const workingFolder = getWorkingFolder(tr.stdout);

            expect(tr.invokedToolCount).toBe(3); // 1 for task, and two for login and logout
            expect(tr.stderr).toBeEmpty();
            expect(tr.errorIssues).toBeEmpty();
            expect(tr.succeeded).toBeTrue();

            const configPath = path.resolve(path.join(workingFolder, ".docker"));
            expect(extractFromLog(tr.stdout, "Setting DOCKER_CONFIG")).toBe(configPath)
            
            expect(tr.stdout).toContain(`[command]echo password | docker --config ${configPath} login --username username --password-stdin registryUrl`)
            expect(tr.stdout).toContain(`[command]docker --config ${configPath} logout registryUrl`)

            done();
        });

        it('Clears up even if the task fails', (done) => {
            let tp = path.join(__dirname, 'DockerRegistryServiceFailingTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            const workingFolder = getWorkingFolder(tr.stdout);

            expect(tr.invokedToolCount).toBe(3); // 1 for task, and two for login and logout
            expect(tr.stderr).toBeEmpty();
            expect(tr.errorIssues).not.toBeEmpty();
            expect(tr.failed).toBeTrue();

            const configPath = path.resolve(path.join(workingFolder, ".docker"));
            expect(extractFromLog(tr.stdout, "Setting DOCKER_CONFIG")).toBe(configPath)
            
            expect(tr.stdout).toContain(`[command]echo password | docker --config ${configPath} login --username username --password-stdin registryUrl`)
            expect(tr.stdout).toContain(`[command]docker --config ${configPath} logout registryUrl`)

            done();
        });
    })



});
