import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as shared from './TestShared';
import assert = require('assert');
import * as chai from 'chai';
import * as fs from 'fs';

describe('Powershell with Authentication Suite', function() {
    this.timeout(30000);
    before(async () => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
    });
    beforeEach(async () => {
        delete process.env[shared.TestEnvVars.command];
        delete process.env[shared.TestEnvVars.containerType];
        delete process.env[shared.TestEnvVars.includeLatestTag];
        delete process.env[shared.TestEnvVars.qualifyImageName];
        delete process.env[shared.TestEnvVars.includeLatestTag];
        delete process.env[shared.TestEnvVars.imageName];
        delete process.env[shared.TestEnvVars.enforceDockerNamingConvention];
        delete process.env[shared.TestEnvVars.memoryLimit];
        delete process.env[shared.TestEnvVars.pushMultipleImages];
        delete process.env[shared.TestEnvVars.tagMultipleImages];
        delete process.env[shared.TestEnvVars.arguments];
        delete process.env[shared.TestEnvVars.qualifySourceImageName];
    });
    after(async function() {
    });

    function getWorkingFolder(output:string) {
        const workingFolderRegexMatch = output.match("##vso\\[task.debug\\]taskWorkingFolder=(.*)");
        assert(workingFolderRegexMatch, "Should output location of working folder");
        return workingFolderRegexMatch![1];
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
        it('Runs successfully for Azure', (done:MochaDone) => {
            let tp = path.join(__dirname, 'AzureServiceTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            assert.equal(tr.invokedToolCount, 3, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf('Connect-Azure.ps1') != -1, "Connect to azure should be called");
            assert(tr.stdout.indexOf('Run-AzdoScript.ps1') != -1, "Should invoke the script");
            assert(tr.stdout.indexOf('Disconnect-Azure.ps1') != -1, "Disconnect to azure should be called");

            console.log(tr.stderr);
            done();
        });


        it('Clears up even if the task fails', (done:MochaDone) => {
            let tp = path.join(__dirname, 'AzureServiceFailingTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            assert.equal(tr.invokedToolCount, 3, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Connect-Azure.ps1') != -1, "Connect to azure should be called");
            assert(tr.stdout.indexOf('Run-AzdoScript.ps1') != -1, "Should invoke the script");
            assert(tr.stdout.indexOf('Disconnect-Azure.ps1') != -1, "Disconnect to azure should be called");

            console.log(tr.stderr);
            done();
        });
    })

    describe('Docker', function() {
        it('Runs successfully for Docker', (done:MochaDone) => {
            let tp = path.join(__dirname, 'DockerServiceTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            const workingFolder = getWorkingFolder(tr.stdout);

            assert.equal(tr.invokedToolCount, 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            chai.assert.equal(extractFromLog(tr.stdout, "Setting DOCKER_CERT_PATH"), path.join(workingFolder, "docker-certs"), "should set docker certificate location")
            chai.assert.equal(extractFromLog(tr.stdout, "Setting DOCKER_HOST"), "tcp://docker", "docker host should be specified")
            chai.assert.equal(extractFromLog(tr.stdout, "Setting DOCKER_TLS_VERIFY"), "true", "docker tls verify is set")

            chai.assert.equal(fs.readFileSync(path.join(workingFolder, "docker-certs", "ca.pem")).toString(), "CaCert", "CA certificate is correct")
            chai.assert.equal(fs.readFileSync(path.join(workingFolder, "docker-certs", "cert.pem")).toString(), "Cert", "Client certificate is correct")
            chai.assert.equal(fs.readFileSync(path.join(workingFolder, "docker-certs", "key.pem")).toString(), "Key", "Client key is correct")            

            assert(tr.stdout.indexOf('Run-AzdoScript.ps1') != -1, "Should invoke the script");

            console.log(tr.stderr);
            done();
        });


        it('Clears up even if the task fails', (done:MochaDone) => {
            let tp = path.join(__dirname, 'DockerServiceFailingTest.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();

            const workingFolder = getWorkingFolder(tr.stdout);

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.failed, 'task should have failed');
            
            chai.assert.equal(extractFromLog(tr.stdout, "Setting DOCKER_CERT_PATH"), path.join(workingFolder, "docker-certs"), "should set docker certificate location")

            chai.assert.equal(extractFromLog(tr.stdout, "Setting DOCKER_HOST"), "tcp://docker", "docker host should be specified")
            chai.assert.equal(extractFromLog(tr.stdout, "Setting DOCKER_TLS_VERIFY"), "true", "docker tls verify is set")
            
            assert(tr.stdout.indexOf('Run-AzdoScript.ps1') != -1, "Should invoke the script");

            chai.assert.equal(fs.readFileSync(path.join(workingFolder, "docker-certs", "ca.pem")).toString(), "CaCert", "CA certificate is correct")
            chai.assert.equal(fs.readFileSync(path.join(workingFolder, "docker-certs", "cert.pem")).toString(), "Cert", "Client certificate is correct")
            chai.assert.equal(fs.readFileSync(path.join(workingFolder, "docker-certs", "key.pem")).toString(), "Key", "Client key is correct")            

            console.log(tr.stderr);
            done();
        });
    })
});
