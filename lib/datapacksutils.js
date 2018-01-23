var fs = require("fs-extra");
var path  = require('path');
var stringify = require('json-stable-stringify');
var async = require('async');
var yaml = require('js-yaml');

// use consts for setting the namespace prefix so that we easily can reference it later on in this file
const namespacePrefix = 'vlocity_namespace';
const namespaceFieldPrefix = '%' + namespacePrefix + '%__';

var DataPacksUtils = module.exports = function(vlocity) {
    this.vlocity = vlocity || {};

    this.dataPacksExpandedDefinition = yaml.safeLoad(fs.readFileSync(path.join(__dirname, "datapacksexpanddefinition.yaml"), 'utf8'));

    this.runJavaScriptModules = {};

    this.startTime = new Date().toISOString();
    this.alreadyWrittenLogs = [];
    this.perfTimers = {};
};

DataPacksUtils.prototype.perfTimer = function(key) {

    if (this.perfTimers[key]) {
        VlocityUtils.log('Elapsed: ' + key, Date.now() - this.perfTimers[key]);

        delete this.perfTimers[key];
    } else {
        this.perfTimers[key] = Date.now();
    }
}

DataPacksUtils.prototype.updateExpandedDefinitionNamespace = function(currentData) {
    var self = this;
    
     if (Array.isArray(currentData)) {
        var replacedArray = [];

        currentData.forEach(function(val){
            replacedArray.push(self.updateExpandedDefinitionNamespace(val));
        });

        return replacedArray;
    } else if (typeof currentData === 'object') {
        var replacedObject = {};

        Object.keys(currentData).forEach(function(key) {
            if (key.indexOf(namespaceFieldPrefix) == -1 && key.indexOf('__c')) {
                replacedObject[self.updateExpandedDefinitionNamespace(key)] = self.updateExpandedDefinitionNamespace(currentData[key]);
            }
        });

        return replacedObject;
    } else {

        if (typeof currentData === 'string') {

            if (currentData.indexOf(namespaceFieldPrefix) == -1 && currentData.indexOf('.') > 0) {

                var finalString = '';

                currentData.split('.').forEach(function(field) {

                    if (finalString != '') {
                        finalString += '.';
                    }

                    if (field.indexOf('__c') > 0 || field.indexOf('__r') > 0) {
                        finalString += namespaceFieldPrefix + field;
                    } else {
                        finalString += field;
                    }
                });
                return finalString;
            } else if (currentData.indexOf(namespaceFieldPrefix) == -1 && currentData.indexOf('__c') > 0) {
                return namespaceFieldPrefix + currentData;
            }
        }

        return currentData;
    } 
};

DataPacksUtils.prototype.overrideExpandedDefinition = function(expandedDefinition) {
    this.overrideExpandedDefinitions = 
        this.updateExpandedDefinitionNamespace(JSON.parse(JSON.stringify(expandedDefinition)));
    
    //JSON.parse(JSON.stringify(expandedDefinition).replace(/vlocity_namespace/g, '%vlocity_namespace%'));
};

DataPacksUtils.prototype.getDataField = function(dataPackData) {
    var dataKey;

    Object.keys(dataPackData.VlocityDataPackData).forEach(function(key) {

        if (Array.isArray(dataPackData.VlocityDataPackData[key]) && dataPackData.VlocityDataPackData[key].length > 0 && dataPackData.VlocityDataPackData[key][0].VlocityRecordSObjectType) {
            dataKey = dataPackData.VlocityDataPackData[key][0].VlocityRecordSObjectType;
        }
    });

    return dataKey; 
}

DataPacksUtils.prototype.getListFileName = function(dataPackType, SObjectType) {
  
    var listFileNameKeys = this.getExpandedDefinition(dataPackType, SObjectType, "ListFileName");

    if (!listFileNameKeys) {
    
        var defaultListFileName = SObjectType.replace(/%vlocity_namespace%__|__c/g, "");

        if (defaultListFileName.substr(defaultListFileName.length-1, 1) == 'y') {
            defaultListFileName = '_' + defaultListFileName.substr(0, defaultListFileName.length-1) + 'ies';
        } else if (defaultListFileName.substr(defaultListFileName.length-1, 1) != 's') {
            defaultListFileName = '_' + defaultListFileName + 's';
        }

        listFileNameKeys = [ defaultListFileName ];
    }

    return listFileNameKeys;
}

DataPacksUtils.prototype.getSortFields = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "SortFields");
}

DataPacksUtils.prototype.isDoNotExpand = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "DoNotExpand");
}

DataPacksUtils.prototype.getFilterFields = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "FilterFields");
}

DataPacksUtils.prototype.getFileName = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "FileName");
}

DataPacksUtils.prototype.getSourceKeyGenerationFields = function(SObjectType) {
    return this.getExpandedDefinition(null, SObjectType, "SourceKeyGenerationFields");
}

DataPacksUtils.prototype.getSourceKeyDefinitionFields = function(SObjectType) {
    return this.getExpandedDefinition(null, SObjectType, "SourceKeyDefinition");
}

DataPacksUtils.prototype.getMatchingSourceKeyDefinitionFields = function(SObjectType) {
    return this.getExpandedDefinition(null, SObjectType, "MatchingSourceKeyDefinition");
}

DataPacksUtils.prototype.getFolderName = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "FolderName");
}

DataPacksUtils.prototype.getFileType = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "FileType");
}

DataPacksUtils.prototype.getJsonFields = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "JsonFields");
}

DataPacksUtils.prototype.getHashFields = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "HashFields");
}

DataPacksUtils.prototype.getReplacementFields = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "ReplacementFields");
}

DataPacksUtils.prototype.isNonUnique = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "NonUnique");
}

DataPacksUtils.prototype.getPaginationSize = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, null, "PaginationSize");
}

DataPacksUtils.prototype.isRemoveNullValues = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "RemoveNullValues");
}

DataPacksUtils.prototype.getUnhashableFields = function(dataPackType, SObjectType) {
    return this.getExpandedDefinition(dataPackType, SObjectType, "UnhashableFields");
}

DataPacksUtils.prototype.isAllowParallel = function(dataPackType) {
    return this.getExpandedDefinition(dataPackType, null, "SupportParallel");
}

DataPacksUtils.prototype.getMaxDeploy = function(dataPackType) {
    return this.getExpandedDefinition(dataPackType, null, "MaxDeploy");
}

DataPacksUtils.prototype.getHeadersOnly = function(dataPackType) {
    return this.getExpandedDefinition(dataPackType, null, "HeadersOnly");
}

DataPacksUtils.prototype.getExportGroupSizeForType = function(dataPackType) {
    return this.getExpandedDefinition(dataPackType, null, "ExportGroupSize");
}

DataPacksUtils.prototype.isGuaranteedParentKey = function(parentKey) {

    return (this.overrideExpandedDefinitions 
        && this.overrideExpandedDefinitions.GuaranteedParentKeys 
        && this.overrideExpandedDefinitions.GuaranteedParentKeys.indexOf(parentKey) != -1) 
        || this.dataPacksExpandedDefinition.GuaranteedParentKeys.indexOf(parentKey) != -1;
}

DataPacksUtils.prototype.getApexImportDataKeys = function(SObjectType) {
    var defaults = ["VlocityRecordSObjectType", "Name"];
    var apexImportDataKeys = this.getSourceKeyDefinitionFields(SObjectType); 

    if (apexImportDataKeys) {
        return defaults.concat(apexImportDataKeys);
    }

    return defaults;
}

DataPacksUtils.prototype.isCompiledField = function(dataPackType, SObjectType, field) {
    var compiledFields = this.getExpandedDefinition(dataPackType, SObjectType, "CompiledFields");
    return compiledFields && compiledFields.indexOf(field) != -1;
}

DataPacksUtils.prototype.hasExpandedDefinition = function(dataPackType, SObjectType) {
    return this.dataPacksExpandedDefinition[dataPackType] && this.dataPacksExpandedDefinition[dataPackType][SObjectType];
}

DataPacksUtils.prototype.getExpandedDefinition = function(dataPackType, SObjectType, dataKey) {
    var definitionValue;
    if (this.overrideExpandedDefinitions) {
        definitionValue = this.getExpandedDefinitionFromMap(dataPackType, SObjectType, dataKey, this.overrideExpandedDefinitions);
    }

    if (definitionValue === undefined) { 
        definitionValue = this.getExpandedDefinitionFromMap(dataPackType, SObjectType, dataKey, this.dataPacksExpandedDefinition);
    }

    if (definitionValue === undefined) {
        if (SObjectType && this.dataPacksExpandedDefinition.SObjectsDefault[dataKey]) {
            definitionValue = this.dataPacksExpandedDefinition.SObjectsDefault[dataKey]; 
        } else if (this.dataPacksExpandedDefinition.DataPacksDefault[dataKey]) {
            definitionValue = this.dataPacksExpandedDefinition.DataPacksDefault[dataKey]; 
        }
    }

    return definitionValue;
}

DataPacksUtils.prototype.getExpandedDefinitionFromMap = function(dataPackType, SObjectType, dataKey, expandedDefinition) {
    if (dataPackType && 
        expandedDefinition.DataPacks && 
        expandedDefinition.DataPacks[dataPackType]) {
        if (SObjectType && 
            expandedDefinition.DataPacks[dataPackType][SObjectType] && 
            expandedDefinition.DataPacks[dataPackType][SObjectType][dataKey]) {
            return expandedDefinition.DataPacks[dataPackType][SObjectType][dataKey]; 
        }
        if(expandedDefinition.DataPacks[dataPackType][dataKey]) {
            return expandedDefinition.DataPacks[dataPackType][dataKey]; 
        }
    }

    if (SObjectType && 
        expandedDefinition.SObjects && 
        expandedDefinition.SObjects[SObjectType] && 
        expandedDefinition.SObjects[SObjectType][dataKey]) {
        return expandedDefinition.SObjects[SObjectType][dataKey];
    }
}

// Traverse JSON and get all Ids
DataPacksUtils.prototype.getAllSObjectIds = function(currentData, currentIdsOnly, typePlusId) {
    var self = this;

    if (currentData) {
       
        if (Array.isArray(currentData)) {
            currentData.forEach(function(childData) {
                self.getAllSObjectIds(childData, currentIdsOnly, typePlusId);
            });

        } else {

            if (currentData.VlocityDataPackType == "SObject") {
                if (currentData.Id) {
                    currentIdsOnly.push(currentData.Id);
                    typePlusId.push({ SObjectType: currentData.VlocityRecordSObjectType, Id: currentData.Id });
                }
            }
           
            Object.keys(currentData).forEach(function(sobjectField) {
                if (typeof currentData[sobjectField] === "object") {
                    self.getAllSObjectIds(currentData[sobjectField], currentIdsOnly, typePlusId);
                } 
            });
        }
    }
};

DataPacksUtils.prototype.getDirectories = function(srcpath, recusive, rootpath) {
	var dirs = [];
	try {        
        rootpath = path.normalize(rootpath || srcpath);
        fs.readdirSync(srcpath).forEach((file) => {
            var fullname = path.join(srcpath, file);
            var fstat = fs.statSync(fullname);
            if (fstat.isDirectory()) {
                dirs.push(fullname.substr(rootpath.length + path.sep.length));
                if(recusive) {
                    dirs = dirs.concat(this.getDirectories(fullname, recusive, rootpath || srcpath))
                }
            }
        });        
    } catch(e) {
	}   
	return dirs;
};

DataPacksUtils.prototype.getFiles = function(srcpath) {
    try {
        return fs.readdirSync(srcpath).filter(function(file) {
            return fs.statSync(path.join(srcpath, file)).isFile();
        });
    } catch(e) {
        return [];
    }
};

DataPacksUtils.prototype.fileExists = function(srcpath) {
    try {
        fs.statSync(srcpath);
    } catch (e) {
        return false;
    }
    
    return true;
}

DataPacksUtils.prototype.getParents = function(jobInfo, currentData, dataPackKey) {
    var self = this;

    if (currentData) {
        if (currentData.VlocityDataPackData) {
            var dataField = self.vlocity.datapacksutils.getDataField(currentData);

            if (dataField) {
                currentData.VlocityDataPackData[dataField].forEach(function(sobjectData) {
                    if (jobInfo.allParents.indexOf(currentData.VlocityDataPackKey) == -1) {
                        jobInfo.allParents.push(currentData.VlocityDataPackKey);
                    }
                    
                    self.getParents(jobInfo, sobjectData, currentData.VlocityDataPackKey);
                });
            }
        } else { 
           
            if (Array.isArray(currentData)) {
                currentData.forEach(function(childData) {
                    self.getParents(jobInfo, childData, dataPackKey);
                });

            } else {       
            
                if (currentData.VlocityDataPackType != 'VlocityLookupMatchingKeyObject' && currentData.VlocityDataPackType != 'VlocityMatchingKeyObject') {

                    // Make as Array because can Export Multiple Keys due to the way dependencies are exported
                    if (!jobInfo.sourceKeysByParent[currentData.VlocityRecordSourceKey]) {
                        jobInfo.sourceKeysByParent[currentData.VlocityRecordSourceKey] = [];
                    }

                    if (jobInfo.sourceKeysByParent[currentData.VlocityRecordSourceKey].indexOf(dataPackKey) == -1) {
                        jobInfo.sourceKeysByParent[currentData.VlocityRecordSourceKey].push(dataPackKey);
                    }

                    Object.keys(currentData).forEach(function(key) {
                        if (Array.isArray(currentData[key])) {
                            self.getParents(jobInfo, currentData[key], dataPackKey);
                        }
                    }); 
                }
            }
        }
    }
}

DataPacksUtils.prototype.initializeFromProject = function(jobInfo) {
    var self = this;

    if (!self.fileExists(jobInfo.projectPath)) {
        return;
    }

    var jobInfoTemp = JSON.parse(stringify(jobInfo));

    jobInfoTemp.singleFile = true;
    VlocityUtils.silence = true;
    jobInfoTemp.compileOnBuild = false;
    jobInfoTemp.manifest = null;

    self.vlocity.datapacksbuilder.buildImport(jobInfo.projectPath, jobInfoTemp, function(dataJson) { 
        VlocityUtils.silence = false;

        if (dataJson && dataJson.dataPacks) {
            dataJson.dataPacks.forEach(function(dataPack) {
                self.getParents(jobInfo, dataPack);
            });
        }
    });
}

DataPacksUtils.prototype.isInManifest = function(dataPackData, manifest) {
    
    if (manifest[dataPackData.VlocityDataPackType]) {
        for (var i = 0; i < manifest[dataPackData.VlocityDataPackType].length; i++)
        {
            var man = manifest[dataPackData.VlocityDataPackType][i];

            if (typeof man == 'object') {
                var isMatching = true;

                Object.keys(man).forEach(function(key) {
                    if (man[key] != dataPackData[key]) {
                        isMatching = false;
                    }
                });

                if (isMatching) {
                    return isMatching;
                }
            } else if (man == dataPackData.Id) {
                return true;
            }
        }
    }

    return false;
}

DataPacksUtils.prototype.loadApex = function(projectPath, filePath, currentContextData) {
    var self = this;

    var defaultApexPath = path.join(__dirname, '..', 'apex', filePath);
   
    if (this.vlocity.datapacksutils.fileExists(projectPath + '/' + filePath)) {
        VlocityUtils.report('Loading Apex', projectPath + '/' + filePath);
        var apexFileName = projectPath + '/' + filePath;
    } else if (this.vlocity.datapacksutils.fileExists(defaultApexPath)) {
        VlocityUtils.report('Loading Apex',  defaultApexPath);
        var apexFileName = defaultApexPath;
    } else {
        return Promise.reject('The specified file \'' + filePath + '\' does not exist.');
    }

    if (apexFileName) {
        var apexFileData = fs.readFileSync(apexFileName, 'utf8');
        var includes = apexFileData.match(/\/\/include(.*?);/g);
        var includePromises = [];

        if (includes) {
            var srcdir = path.dirname(apexFileName);
            for (var i = 0; i < includes.length; i++) {
                var replacement = includes[i];
                var className = replacement.replace("//include ", "").replace(";", "");             
                includePromises.push(
                    this.loadApex(srcdir, className, currentContextData).then((includedFileData) => {
                        apexFileData = apexFileData.replace(replacement, includedFileData);
                        return apexFileData;
                    }
                ));         
            }
        }

        return Promise.all(includePromises).then(() => {

            if (!currentContextData) {
                currentContextData = [];
            }

            apexFileData = apexFileData.replace(/CURRENT_DATA_PACKS_CONTEXT_DATA/g, JSON.stringify(currentContextData));
            
            return apexFileData
                .replace(/%vlocity_namespace%/g, this.vlocity.namespace)
                .replace(/vlocity_namespace/g, this.vlocity.namespace);
        });
    } else {
        return Promise.reject('ProjectPath or filePath arguments passed as null or undefined.');        
    }
}

DataPacksUtils.prototype.runApex = function(projectPath, filePath, currentContextData) {
    var self = this;

    return this
        .loadApex(projectPath, filePath, currentContextData)
        .then((apexFileData) => { 
            return new Promise((resolve, reject) => {
                self.vlocity.jsForceConnection.tooling.executeAnonymous(apexFileData, (err, res) => {

                    if (err) return reject(err);

                    if (res.success === true) return resolve(true);
                    if (res.compileProblem) {
                        VlocityUtils.error('APEX Compilation Error', res.compileProblem);
                    } 
                    if (res.exceptionMessage) {
                        VlocityUtils.error('APEX Exception Message', res.exceptionMessage);
                    }
                    if (res.exceptionStackTrace) {
                        VlocityUtils.error('APEX Exception StackTrace', res.exceptionStackTrace);
                    }

                    return reject(res.compileProblem || res.exceptionMessage || 'APEX code failed to execute but no exception message was provided');
                });
            });
        });
};

DataPacksUtils.prototype.runJavaScript = function(projectPath, filePath, currentContextData, jobInfo, callback) {
    var self = this;
    
    var pathToRun = path.join(projectPath, filePath);

    var defaultJSPath = path.resolve(path.join(__dirname, '..', 'javascript', filePath));

    if (!self.fileExists(pathToRun) && self.fileExists(defaultJSPath)) {
        pathToRun = defaultJSPath;
    }

    pathToRun = path.resolve(pathToRun);
    if (!self.runJavaScriptModules[pathToRun]) {
        self.runJavaScriptModules[pathToRun] = require(pathToRun);
    }

    self.runJavaScriptModules[pathToRun](self.vlocity, currentContextData, jobInfo, callback);
};

DataPacksUtils.prototype.hashCode = function(toHash) {
    var hash = 0, i, chr;

    if (toHash.length === 0) return hash;

    for (i = 0; i < toHash.length; i++) {
        chr   = toHash.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }

    return hash;
};

// Stolen from StackOverflow
DataPacksUtils.prototype.guid = function(seed) {

    if (typeof seed === 'string') {
        seed = this.hashCode(seed);
    } else if (!seed) {
        seed = Math.floor((1 + Math.random()) * 0x10000) 
    }

    function random() {
        var x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    function s4() {
        return Math.floor((1 + random()) * 0x10000)
        .toString(16)
        .substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
};

DataPacksUtils.prototype.removeUnhashableFields = function(dataPackType, dataPackData) {
    var self = this;

    if (dataPackData && dataPackData.VlocityRecordSObjectType) {

        var unhashableFields = self.getUnhashableFields(dataPackType, dataPackData.VlocityRecordSObjectType);

        if (unhashableFields) {
            unhashableFields.forEach(function(field) {
                delete dataPackData[field];
            });
        }

        var filterFields = self.getFilterFields(dataPackType, dataPackData.VlocityRecordSObjectType);

        if (filterFields) {
            filterFields.forEach(function(field) {
                delete dataPackData[field];
            });
        }

        delete dataPackData.VlocityMatchingRecordSourceKey;
        delete dataPackData.VlocityRecordSourceKey;
        delete dataPackData.VlocityRecordSourceKeyOriginal;
        delete dataPackData.VlocityLookupRecordSourceKey;
        delete dataPackData.VlocityDataPackType;
        delete dataPackData.Id;

        Object.keys(dataPackData).forEach(function(childDataKey) {

            var childData = dataPackData[childDataKey];

            if (!childData) {
                delete dataPackData[childDataKey];
            } else if (Array.isArray(childData)) {
                childData.forEach(function(child) {
                    self.removeUnhashableFields(dataPackType, child);
                });
            } else if (typeof childData === 'object') {
                self.removeUnhashableFields(dataPackType, childData);
            } else if (typeof childData === 'string') {
                try {
                    // Remove extra line endings if there 
                    dataPackData[childDataKey] = stringify(JSON.parse(dataPackData[childDataKey]));
                } catch (e) {
                    // Can ignore
                }
            }
        });
    }
}

DataPacksUtils.prototype.getDisplayName = function(dataPack) {
    var name = '';
    var self = this;

    self.getExpandedDefinition(dataPack.VlocityDataPackType, null, "DisplayName").forEach(function(field) {
        if (dataPack[field]) {
            if (name) {
                name += ' ';
            }

            name += dataPack[field] ;
        }
    });

    if (!name && dataPack.Name) {
        name = dataPack.Name;
    }

    if (dataPack.Id) {
        if (name) {
            name += ' (' + dataPack.Id + ')';
        } else {
            name = dataPack.Id;
        }
    }

    return name;
}

DataPacksUtils.prototype.getDataPackHashable = function(dataPack, jobInfo) {
    var self = this;

    var clonedDataPackData = JSON.parse(stringify(dataPack));

    var beforePreprocess = stringify(dataPack);

    self.vlocity.datapacksexpand.preprocessDataPack(clonedDataPackData, jobInfo);

    var afterPreprocess = stringify(clonedDataPackData);

    // Remove these as they would not be real changes
    clonedDataPackData.VlocityDataPackParents = null;
    clonedDataPackData.VlocityDataPackAllRelationships = null;

    var dataField = self.getDataField(clonedDataPackData);

    clonedDataPackData.VlocityDataPackType, clonedDataPackData.VlocityDataPackData[dataField].forEach(function(sobjectData) {
        self.removeUnhashableFields(clonedDataPackData.VlocityDataPackType, sobjectData);
    });

    return clonedDataPackData;
};

DataPacksUtils.prototype.endsWith = function(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

DataPacksUtils.prototype.countRemainingInManifest = function(jobInfo) {

    jobInfo.exportRemaining = 0;

    Object.keys(jobInfo.fullManifest).forEach(function(dataPackType) {

        if (!jobInfo.alreadyExportedIdsByType[dataPackType]) {
            jobInfo.alreadyExportedIdsByType[dataPackType] = [];
        }

        if (!jobInfo.alreadyErroredIdsByType[dataPackType]) {
            jobInfo.alreadyErroredIdsByType[dataPackType] = [];
        }

        Object.keys(jobInfo.fullManifest[dataPackType]).forEach(function(dataPackKey) {

            var dataPackId = jobInfo.fullManifest[dataPackType][dataPackKey].Id;

            if (jobInfo.alreadyExportedIdsByType[dataPackType].indexOf(dataPackId) == -1
                && jobInfo.alreadyExportedIdsByType[dataPackType].indexOf(dataPackKey) == -1
                && jobInfo.alreadyErroredIdsByType[dataPackType].indexOf(dataPackId) == -1
                && jobInfo.alreadyExportedKeys.indexOf(dataPackKey) == -1
                && jobInfo.currentStatus[dataPackKey] != 'Error'
                && jobInfo.currentStatus[dataPackKey] != 'Ignored') {
                jobInfo.exportRemaining++;
            }
        });
    });
}

DataPacksUtils.prototype.printJobStatus = function(jobInfo) {

    var totalRemaining = 0;
    var successfulCount = 0;
    var errorsCount = 0;
    var ignoredCount = 0;

    if (!jobInfo.currentStatus) {
        return;
    }

    var keysByStatus = {};
    
    Object.keys(jobInfo.currentStatus).forEach(function(dataPackKey) { 

        var status = jobInfo.currentStatus[dataPackKey];
        if (jobInfo.currentStatus[dataPackKey] == 'Ready' 
            || jobInfo.currentStatus[dataPackKey] == 'Header' 
            || jobInfo.currentStatus[dataPackKey] == 'Added'
            || jobInfo.currentStatus[dataPackKey] == 'ReadySeparate') {
            status = 'Remaining';
                totalRemaining++;
        } else if (jobInfo.currentStatus[dataPackKey] == 'Error') {
            errorsCount++;
        } else if (jobInfo.currentStatus[dataPackKey] == 'Success') {
            successfulCount++;
        }

        if (!keysByStatus[status]) {
            keysByStatus[status] = {};
        }

        // For Exports
        var keyForStatus = jobInfo.vlocityKeysToNewNamesMap[dataPackKey] ? jobInfo.vlocityKeysToNewNamesMap[dataPackKey] : dataPackKey;

        if (keyForStatus.indexOf('/') != -1) {

            var slashIndex = keyForStatus.indexOf('/');
            var beforeSlash = keyForStatus.substring(0, slashIndex);
            var afterSlash = keyForStatus.substring(slashIndex+1);

            if (!keysByStatus[status][beforeSlash]) {
                keysByStatus[status][beforeSlash] = [];
            }
            var dataPackName = jobInfo.generatedKeysToNames[keyForStatus];

            if (dataPackName && afterSlash.indexOf(dataPackName) == -1) {
                afterSlash = dataPackName + ' - ' + afterSlash;
            }

            if (keysByStatus[status][beforeSlash].indexOf(afterSlash) == -1) {
                keysByStatus[status][beforeSlash].push(afterSlash);
            }
        }
    });

    if (jobInfo.jobAction == 'Export' 
        || jobInfo.jobAction == 'GetDiffs'
        || jobInfo.jobAction == 'GetDiffsAndDeploy') {
        this.countRemainingInManifest(jobInfo);
        totalRemaining = jobInfo.exportRemaining;
    }

    if (totalRemaining == 0 
        && successfulCount == 0 
        && errorsCount == 0) {
        return;
    }

    var elapsedTime = (Date.now() - jobInfo.startTime) / 1000;

    if (jobInfo.headersOnly) {
        VlocityUtils.report('Uploading Only Parent Objects');
    }

    if (!jobInfo.supportParallel) {
        VlocityUtils.report('Parallel Processing', 'Off');
    }

    if (jobInfo.forceDeploy) {
        VlocityUtils.report('Force Deploy', 'On');
    }

    if (jobInfo.ignoreAllParents) {
        VlocityUtils.report('Ignoring Parents');
    }
    
    if (this.vlocity.username) {
        VlocityUtils.report('Salesforce Org', this.vlocity.username);
    }
    
    VlocityUtils.report('Current Status', jobInfo.jobAction);
    VlocityUtils.success('Successful', successfulCount);
    VlocityUtils.error('Errors', errorsCount);
    VlocityUtils.warn( 'Remaining', totalRemaining);
    VlocityUtils.report('Elapsed Time', Math.floor((elapsedTime / 60)) + 'm ' + Math.floor((elapsedTime % 60)) + 's');

    if (jobInfo.hasError) {
        jobInfo.errorMessage = jobInfo.errors.join('\n').replace(/%vlocity_namespace%/g, this.vlocity.namespace);
    }

    var countByStatus = {};

    Object.keys(keysByStatus).forEach(function(statusKey) {
        countByStatus[statusKey] = {};

        Object.keys(keysByStatus[statusKey]).forEach(function(typeKey) {
            countByStatus[statusKey][typeKey] = keysByStatus[statusKey][typeKey].length;

            if (jobInfo.fullStatus) {

                var messageBeginning = typeKey + ' - ' + statusKey;
                var total = keysByStatus[statusKey][typeKey].length;

                if (statusKey == 'Success') {
                    VlocityUtils.success(messageBeginning, total);
                } else if (statusKey == 'Error') {
                    VlocityUtils.error(messageBeginning, total);
                } else {
                    VlocityUtils.warn(messageBeginning, total);
                }
            }
            
            keysByStatus[statusKey][typeKey].sort();
        });
    });

    var logInfo = {
        Job: jobInfo.jobName,
        Action: jobInfo.jobAction,
        ProjectPath: jobInfo.projectPath,
        TotalTime: Math.floor((elapsedTime / 60)) + 'm ' + Math.floor((elapsedTime % 60)) + 's',
        Count: countByStatus,
        Errors: jobInfo.errors,
        Status: keysByStatus
    };

    try {
        fs.outputFileSync(path.join('vlocity-temp', 'logs', jobInfo.logName), yaml.dump(logInfo, { lineWidth: 1000 }));
    } catch (e) {
        VlocityUtils.log(e);
    }
};