var request = require('request');
var yaml = require('js-yaml');
var path = require('path');
var fs = require('fs-extra');
var sass = require('sass.js');
var stringify = require('json-stable-stringify');

var UTF8_EXTENSIONS = [ "css", "json", "yaml", "scss", "html", "js"];

var DataPacksBuilder = module.exports = function(vlocity) {
    this.vlocity = vlocity || {};

    this.dataPacksExpandedDefinition = JSON.parse(fs.readFileSync(path.join(__dirname, "datapacksexpanddefinition.json"), 'utf8'));

    this.compileQueue = []; // array with files that require compilation
};

DataPacksBuilder.prototype.buildImport = function(importPath, manifest, jobInfo, onComplete) {
     var self = this;
    
    if (self.vlocity.verbose) {
        console.log('\x1b[31m', 'buildImport >>' ,'\x1b[0m', importPath, jobInfo.manifest, jobInfo);
    }
    
    var dataPackImport = JSON.parse(fs.readFileSync(path.join(__dirname, 'defaultdatapack.json'), 'utf8'));

    var maxImportSize = 200000;
    var maxImportCount = 200000;

    if (jobInfo.resetFileData) {
        self.allFileDataMap = null;
        jobInfo.resetFileData = false;
    }

    if (jobInfo.maximumFileSize) {
        maxImportSize = jobInfo.maximumFileSize;
    }

    if (jobInfo.maximumDeployCount) {
        maxImportCount = jobInfo.maximumDeployCount;
    }

    if (jobInfo.expansionPath) {
        importPath += '/' + jobInfo.expansionPath;
    }

    self.compileOnBuild = jobInfo.compileOnBuild;

    if (!self.allFileDataMap) {
        self.initializeImportStatus(importPath, manifest, jobInfo);
    }

    var nextImport;

    var currentDataPackKeysInImport = {};

    do {
        
        nextImport = self.getNextImport(importPath, Object.keys(jobInfo.currentStatus), jobInfo.singleFile === true, jobInfo, currentDataPackKeysInImport);

        if (nextImport) {
            currentDataPackKeysInImport[nextImport.VlocityDataPackKey] = true;
            dataPackImport.dataPacks.push(nextImport);
  
            if (!jobInfo.singleFile && self.vlocity.datapacksutils.isSoloDeploy(nextImport.VlocityDataPackType)) {
                break;
            }
        }

    } while (nextImport && (jobInfo.singleFile || (stringify(dataPackImport).length < maxImportSize && dataPackImport.dataPacks.length < maxImportCount)))

    self.compileQueuedData(result => {
        if(result.hasErrors) {            
            jobInfo.hasError = true;
            jobInfo.errorMessage = result.errors.join('\n');
        }
        onComplete(dataPackImport.dataPacks.length > 0 ? dataPackImport : null);
    });
};

DataPacksBuilder.prototype.loadFilesAtPath = function(srcpath, jobInfo, dataPackKey) {
    var self = this;

    self.vlocity.datapacksutils.getFiles(srcpath).forEach(function(filename) {

        var encoding = 'base64';

        var extension = filename.substr(filename.lastIndexOf('.')+1);

        if (UTF8_EXTENSIONS.indexOf(extension) > -1) {
            encoding = 'utf8';
        }

        if (!self.allFileDataMap) {
            self.allFileDataMap = {};
        }

        var filemapkey = (srcpath + '/' + filename).toLowerCase();
        self.allFileDataMap[filemapkey] = fs.readFileSync(srcpath + '/' + filename, encoding);

        if (filename.indexOf('_DataPack') != -1) {

            var jsonData = JSON.parse(self.allFileDataMap[filemapkey]);
            var apexImportData = {};

            self.vlocity.datapacksutils.getApexImportDataKeys(jsonData.VlocityRecordSObjectType).forEach(function(field) {
                apexImportData[field] = jsonData[field];
            });

            if (jobInfo.preDeployDataSummary == null) {
                jobInfo.preDeployDataSummary = [];
            }

            if (jobInfo.allDeployDataSummary == null) {
                jobInfo.allDeployDataSummary = {};
            }

            jobInfo.preDeployDataSummary.push(apexImportData);

            if (dataPackKey) {
                jobInfo.allDeployDataSummary[dataPackKey] = apexImportData;
            }
        }
    });
};

DataPacksBuilder.prototype.getDataPackLabel = function(dataPackTypeDir, dataPackName) {
    try {
            var allFiles = this.vlocity.datapacksutils.getFiles(dataPackTypeDir + '/' + dataPackName);
        for (var i = 0; i < allFiles.length; i++) {
            if (allFiles[i].indexOf('_DataPack.json') != -1) {
               return allFiles[i].substr(0, allFiles[i].indexOf('_DataPack.json'));
            }
        }
    } catch (e) {
        // Means file deleted
    }

    return null;
};

DataPacksBuilder.prototype.initializeImportStatus = function(importPath, manifest, jobInfo) {
    var self = this;

    if (!jobInfo.currentStatus) {
        jobInfo.currentStatus = {};
    }

    var matchingFunction = function(dataPackType, dataPackName) {
        if (Array.isArray(manifest[dataPackType])) {
            return !!manifest[dataPackType].find(function(entry) {
                return (entry.replace(/ /g, '-') == dataPackName);
            });
        }
        var matchingString = manifest[dataPackType];
        if (typeof matchingString != "string") {
            matchingString = stringify(matchingString);
        }
        return (matchingString.indexOf(dataPackName) != -1);
    }

    if (manifest) {
        self.pendingFromManifest = JSON.parse(stringify(manifest));
    } else {
        self.pendingFromManifest = {};
    }

    var importPaths = self.vlocity.datapacksutils.getDirectories(importPath);
    if (self.vlocity.verbose) {
        console.log('\x1b[31m', 'Found import paths >>' ,'\x1b[0m', importPaths);
    }
    importPaths.forEach(function(dataPackType) {

        var dataPackTypeDir = importPath + '/' + dataPackType;
        var allDataPacksOfType = self.vlocity.datapacksutils.getDirectories(dataPackTypeDir);

        if (self.vlocity.verbose) {
            console.log('\x1b[31m', 'Found datapacks >>' ,'\x1b[0m', allDataPacksOfType);
        }

        if (allDataPacksOfType) {
            allDataPacksOfType.forEach(function(dataPackName) {

                var metadataFilename = dataPackTypeDir + '/' + dataPackName + '/' + self.getDataPackLabel(dataPackTypeDir, dataPackName) + '_DataPack.json';
                var dataPackKey = dataPackType + '/' + dataPackName;

                try {
                    if (metadataFilename && (!manifest || (manifest[dataPackType] && matchingFunction(dataPackType, dataPackName)))) {

                        if (self.vlocity.datapacksutils.fileExists(metadataFilename)) {

                            if (!jobInfo.currentStatus[dataPackKey]) {
                                jobInfo.currentStatus[dataPackKey] = 'Ready';
                            }

                            self.loadFilesAtPath(dataPackTypeDir + '/' + dataPackName, jobInfo, dataPackKey);
                            if (Array.isArray(self.pendingFromManifest[dataPackType])) {
                                var beforeCount = self.pendingFromManifest[dataPackType].length;
                                self.pendingFromManifest[dataPackType] = self.pendingFromManifest[dataPackType].filter(function(value) {
                                    return value.replace(/ /g, '-') !== dataPackName;
                                });
                            } else {
                                if (self.pendingFromManifest[dataPackType]) {
                                    self.pendingFromManifest[dataPackType].replace(dataPackName, '');
                                }
                            }
                        } else {
                            console.error('\x1b[31m', 'Missing metadata file for _DataPack.json >> ', '\x1b[0m',  dataPackKey);
                        }
                    }
                } catch (e) {
                    console.error('\x1b[31m', 'Error whilst processing >>' ,'\x1b[0m', dataPackKey, e);
                }
            });
        }
    });

    var hasMissingEntries = false;

    Object.keys(self.pendingFromManifest).forEach(function(key) {
        if (self.pendingFromManifest[key].length > 0) {
            hasMissingEntries = true;
        }
    });

    if (hasMissingEntries) {
        console.error("Unmatched but required files:\n" + stringify(self.pendingFromManifest, null, 2));
    }
};

DataPacksBuilder.prototype.getNextImport = function(importPath, dataPackKeys, singleFile, jobInfo, currentDataPackKeysInImport) {
    var self = this;

    for (var i = 0; i < dataPackKeys.length; i++) {
        
        var dataPackKey = dataPackKeys[i];

        if (jobInfo.currentStatus[dataPackKey] == 'Ready' || (jobInfo.currentStatus[dataPackKey] == 'Header' && !jobInfo.headersOnly)) {
            try {

                var typeIndex = dataPackKey.indexOf('/');
                var dataPackType = dataPackKey.substr(0, typeIndex);
                var dataNameIndex = dataPackKey.lastIndexOf('/')+1;
                var dataPackName = dataPackKey.substr(dataNameIndex);
                var dataPackLabel = self.getDataPackLabel(importPath + '/' + dataPackType, dataPackName);

                var fullPathToFiles = importPath + '/' + dataPackKey;
                var parentData;

                if (!jobInfo.singleFile) {
                    if (self.vlocity.datapacksutils.isSoloDeploy(dataPackType) && Object.keys(currentDataPackKeysInImport).length != 0) {
                        continue;
                    }

                    if (jobInfo.supportParallel && !self.vlocity.datapacksutils.isAllowParallel(dataPackType)) {
                        continue;
                    }
                }

                if (!dataPackLabel) {
                    jobInfo.currentStatus[dataPackKey] = 'Error';
                    continue;
                }

                if (jobInfo.defaultMaxParallel > 1 && !jobInfo.supportParallel && self.vlocity.datapacksutils.isAllowParallel(dataPackType)) {
                    jobInfo.supportParallelAgain = true;
                }

                // Headers only accounts for potential circular references by only uploading the parent record
                if (!jobInfo.headersOnly) {
                   parentData = self.allFileDataMap[ (fullPathToFiles + '/' + dataPackLabel + '_ParentKeys.json').toLowerCase()];
                } else if (!self.vlocity.datapacksutils.isAllowHeadersOnly(dataPackType)) {
                    continue;
                }

                var needsParents = false;

                if (parentData) {

                    parentData = JSON.parse(parentData);

                    if (!singleFile) {
                        parentData.forEach(function(parentKey) {
                            if (jobInfo.currentStatus[parentKey.replace(/\s+/g, "-")] != null && !(jobInfo.currentStatus[parentKey.replace(/\s+/g, "-")] == 'Success' || jobInfo.currentStatus[parentKey.replace(/\s+/g, "-")] == 'Header') && currentDataPackKeysInImport[parentKey.replace(/\s+/g, "-")] != true) {
                                needsParents = true;
                            }
                        });

                        if (needsParents) {
                            continue;
                        }
                    }
                }

                var nextImport = {
                    VlocityDataPackKey: dataPackKey,
                    VlocityDataPackType: dataPackType,
                    VlocityDataPackParents: parentData,
                    VlocityDataPackStatus: 'Success',
                    VlocityDataPackIsIncluded: true,
                    VlocityDataPackName: dataPackName,
                    VlocityDataPackData: {
                    VlocityDataPackKey: dataPackKey,
                    VlocityDataPackType: dataPackType,
                    VlocityDataPackIsIncluded: true
                    }
                }

                var dataPackDataMetadata = JSON.parse(self.allFileDataMap[ (fullPathToFiles + '/' + dataPackLabel + '_DataPack.json').toLowerCase() ]);
                var sobjectDataField = dataPackDataMetadata.VlocityRecordSObjectType;
                // Always an Array in Actualy Data Model
                var dataPackImportBuilt = self.buildFromFiles(dataPackDataMetadata, fullPathToFiles, dataPackType, sobjectDataField);

                if (dataPackImportBuilt[0] != null && dataPackImportBuilt[0].VlocityDataPackType == 'SObject') {
                    sobjectDataField = dataPackImportBuilt[0].VlocityRecordSObjectType;
                }

                if (jobInfo.headersOnly) {
                    Object.keys(dataPackImportBuilt[0]).forEach(function(key) {
                        if (Array.isArray(dataPackImportBuilt[0][key])) {
                            dataPackImportBuilt[0][key] = [];
                        }
                    });
                }

                nextImport.VlocityDataPackData[sobjectDataField] = dataPackImportBuilt;

                if (jobInfo.headersOnly) {
                    jobInfo.currentStatus[dataPackKey] = 'Header';
                } else {
                    jobInfo.currentStatus[dataPackKey] = 'Added';
                }     

                console.log('\x1b[32m', 'Adding to ' + (jobInfo.singleFile ? 'File' : 'Deploy') + ' >>', '\x1b[0m', nextImport.VlocityDataPackType + ' - ' + nextImport.VlocityDataPackName);
                return nextImport;
            } catch (e) {
                console.log('\x1b[31m', 'Error Formatting Deploy >>','\x1b[0m', dataPackKey, e.stack);
                throw e;
            }
        }
    }

    return null;
};

DataPacksBuilder.prototype.buildFromFiles = function(dataPackDataArray, fullPathToFiles, dataPackType, currentDataField) {
    var self = this;

    // The SObjectData in the DataPack is always stored in arrays
    if (!Array.isArray(dataPackDataArray)){
        dataPackDataArray = [ dataPackDataArray ];
    }

    var dataPackDef = self.dataPacksExpandedDefinition[dataPackType];

    if (dataPackDef[currentDataField]) {
        var dataFieldDef = dataPackDef[currentDataField];

        dataPackDataArray.forEach(function(dataPackData) {

            if (dataPackData.VlocityDataPackType) {
                dataPackData.VlocityDataPackIsIncluded = true;
            }

            Object.keys(dataPackData).forEach(function(field) {            
                if (dataFieldDef && dataFieldDef[field]) {

                    var fileNames = dataPackData[field];
                    var fileType = self.dataPacksExpandedDefinition[dataPackType][currentDataField][field];

                    // Check on This idea
                    if (fileType == 'object' && Array.isArray(fileNames)) {

                        var allDataPackFileData = [];

                        fileNames.forEach(function(fileInArray) {
                            var fileInArray = fullPathToFiles + "/" + fileInArray;

                            if (self.allFileDataMap[fileInArray.toLowerCase()]) {
                                 allDataPackFileData = allDataPackFileData.concat(self.buildFromFiles(JSON.parse(self.allFileDataMap[fileInArray.toLowerCase()]), fullPathToFiles, dataPackType, field));
                            } else {
                                console.log('\x1b[31m', 'File Does Not Exist >>' ,'\x1b[0m', fileInArray);
                            }
                        });

                        dataPackData[field] = allDataPackFileData;
                    } else {

                        var filename = fullPathToFiles + "/" + dataPackData[field];

                        if (self.allFileDataMap[filename.toLowerCase()]) {
                            if (fileType == 'list' || fileType == 'object') {
                                dataPackData[field] = self.buildFromFiles(JSON.parse(self.allFileDataMap[filename.toLowerCase()]), fullPathToFiles, dataPackType, field);
                            } else {
                                if (self.compileOnBuild && fileType.CompiledField) { 

                                    // these options will be passed to the importer function 
                                    var importerOptions = {
                                        // collect paths to look for imported/included files
                                        includePaths: self.vlocity.datapacksutils.getDirectories(fullPathToFiles + "/..").map(function(dir) {
                                            return path.normalize(fullPathToFiles + "/../" + dir + "/");
                                        })
                                    };
                                    // Push job to compile qeueu; the data will be compiled after the import is completed
                                    self.compileQueue.push({
                                        filename: filename,
                                        status: null,
                                        language: fileType.FileType,
                                        source: self.allFileDataMap[filename.toLowerCase()],
                                        options: {
                                            // this is options that is passed to the compiler
                                            importer: importerOptions
                                        },
                                        callback: function(error, compiledResult) {
                                            if (error) {
                                                return console.log('\x1b[31m', 'Failed to compile SCSS for >>' ,'\x1b[0m', filename, '\n', error.message);
                                            }
                                            dataPackData[fileType.CompiledField] = compiledResult;
                                        }
                                    });
                                    // save source into datapack to ensure the uncompiled data also gets deployed
                                    dataPackData[field] = self.allFileDataMap[filename.toLowerCase()];
                                } else if (!self.compileOnBuild || 
                                           !self.dataPacksExpandedDefinition[dataPackType][currentDataField].CompiledFields ||
                                            self.dataPacksExpandedDefinition[dataPackType][currentDataField].CompiledFields.indexOf(field) == -1) {
                                    dataPackData[field] = self.allFileDataMap[filename.toLowerCase()];
                                }
                            }
                        } 
                    } 
                }
            });

            if (dataFieldDef && dataFieldDef.JsonFields) {
                dataFieldDef.JsonFields.forEach(function(jsonField) { 
                    if (dataPackData[jsonField] != "") {
                        dataPackData[jsonField] = stringify(dataPackData[jsonField]);
                    }
                });
            }
        });
    }

    return dataPackDataArray;
};

DataPacksBuilder.prototype.compileQueuedData = function(onComplete) {    
    // lcoals we will use to track the progress
    var compileCount = 0;
    var errors = [];
    
    // Sass.js compiler is a bit funcky and the callbacks
    // are not garantueed to be called in the correct order
    // this causes issue and therefor we do not want to compile files in parallel 
    // this compileNext function takes care of that by calling itself recusrively
    var compileNext = (job) => {
        if (!job) {
            if (this.vlocity.verbose && (compileCount > 0 || errors.length > 0)) {
                console.log('\x1b[31m', 'Compilation done >>' ,'\x1b[0m', 'compiled', compileCount, 'files with', errors.length, 'errors.');
            }
            return onComplete({ 
                compileCount: compileCount,
                hasErrors: errors.length > 0, 
                errors: errors
            });
        }

        if (this.vlocity.verbose) {
            console.log('\x1b[31m', 'Start compilation of >>' ,'\x1b[0m', job.filename);
        }

        this.compile(job.language, job.source, job.options || {}, (error, compiledResult) => {
            if(error) {
                console.log('\x1b[31m', error.message, '>>' ,'\x1b[0m', '\n');
                job.callback(error, null);
                errors.push(error);
            } else {
                job.callback(null, compiledResult);
                compileCount++;
            }
            compileNext(this.compileQueue.pop());
        });
    };

    // kick it off!
    compileNext(this.compileQueue.pop());
};


/** 
 * recusive async function that loops through a list of paths trying to read a file and returns the data 
 * of that file if it is succesfull
 * @param {string} filename - name of the file to search for
 * @param {string[]} pathArray - Array of paths to search in
 * @param {callback} cb - callback(err, fileData)
 */
DataPacksBuilder.prototype.tryReadFile = function(fileName, pathArray, cb, i) {
    if ((i = i || 0) >= pathArray.length) return cb(new Error("Requested file not found: " + fileName), null);
    fs.readFile(path.join(pathArray[i], fileName), 'UTF8', (err, data) => {
        if (!err) return cb(null, data);                                    
        this.tryReadFile(fileName, pathArray, cb, ++i);
    });
};

DataPacksBuilder.prototype.compile = function(lang, source, options, cb) {
    // This function contains the core code to execute compilation of source data
    // add addtional languages here to support more compilation types    
    switch(lang) {
        case 'scss': {
            // intercept file loading requests from libsass
            sass.importer((request, done) => {
                // (object) request
                // (string) request.current path libsass wants to load (content of »@import "<path>";«)
                // (string) request.previous absolute path of previously imported file ("stdin" if first)
                // (string) request.resolved currentPath resolved against previousPath
                // (string) request.path absolute path in file system, null if not found
                // (mixed)  request.options the value of options.importer
                // -------------------------------
                // (object) result
                // (string) result.path the absolute path to load from file system
                // (string) result.content the content to use instead of loading a file
                // (string) result.error the error message to print and abort the compilation
                if (!request.path) {
                    // do we have include paths -- if so start probing them
                    if (request.options && request.options.includePaths && 
                        Array.isArray(request.options.includePaths)) {
                        return this.tryReadFile(request.current + '.scss', request.options.includePaths, (err, data) => {
                            if(err) return done({ error: err });
                            done({ content: data });
                        });
                    }
                }                
                // return error
                done({ error: "Unable to resolve requested SASS import; try setting the 'includePaths'" +
                              "compiler option if your import is not in the root directory." });
            });
            sass.compile(source, options, (result) => {
                if (result.status !== 0) {
                    var error = new Error('SASS compilation failed, see error message for details: ' + result.formatted);
                    cb(error, null);
                } else {
                    cb(null, result.text);
                }
            });
        } return;
        default: {       
            cb(new Error('Unknown language: ' + lang), null);
        } return;
    }
};


