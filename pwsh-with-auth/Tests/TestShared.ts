import tl = require('azure-pipelines-task-lib');

export let TestEnvVars = {
    operatingSystem: "__operating_system__",
    command: "__command__",
    containerType: "__container_type__",
    qualifyImageName: "__qualifyImageName__",
    includeLatestTag: "__includeLatestTag__",
    imageName: "__imageName__",
    enforceDockerNamingConvention: "__enforceDockerNamingConvention__",
    memoryLimit: "__memoryLimit__",
    pushMultipleImages: "__pushMultipleImages__",
    tagMultipleImages: "__tagMultipleImages__",
    arguments: "__arguments__",
    qualifySourceImageName: "__qualifySourceImageName__"
};

export let OperatingSystems = {
    Windows: "Windows",
    Other: "Other"
};