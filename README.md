Install
-----------

#### Install Node.js  
Download and Install the Current Version at:
https://nodejs.org/

This project now supports Node Version 8+.

Inside the Git repository you have cloned run the following commands:
```bash   
npm install -g grunt-cli
npm install
```

#### Install Apache Ant (Optional)
http://ant.apache.org/manual/install.html 

Project Setup 
------------
To begin, fill in the information in the build.properties file, or create your own property file.

sf.username: Salesforce Username  
sf.password: Salesforce Password  
vlocity.namespace: The namespace of the Vlocity Package. vlocity_ins, vlocity_cmt, or vlocity_ps  
vlocity.dataPackJob: The name of the Job being run.  

**All commands support "-propertyfile filename.properties"**

#### Basic Grunt Commands
This tool is primarily meant to be used with Grunt.  
https://gruntjs.com/

The supported DataPacks actions for grunt are as follow:

`packExport`: Export from a Salesforce org into a DataPack Directory  
`packDeploy`: Deploy all contents of a DataPacks Directory  
`packGetDiffsAndDeploy`: Deploy only files that are modified compared to the target Org
`packBuildFile`: Build a DataPacks Directory into a DataPack file of  
`packExpandFile`: Create a DataPack Directory from a previosuly exported file
`packExportSingle`: Export a Single DataPack by Id
`packContinue`: Continues a job that failed due to an error
`packRetry`: Continues a Job retrying all deploy errors or re-running all export queries


Grunt commands follow the sytax:  
```bash
grunt -propertyfile MY_ORG.properties -job JOB_NAME packExport
```

The tool also includes an ANT wrapper for packDeploy and packExport. When running a DataPack Job through ANT, the "vlocity.dataPackJob" property will be the job run. A property in a build.properties file can be overridden with: 
```bash
ant packExport -Dvlocity.dataPackJob JOB_NAME
```

By default ANT will use the build.properties file, however the build file can be replaced by specifying the -propertyfile in the command:
```bash
ant -propertyfile MY_ORG.properties packExport
```

DataPack Job Files
------------
The files defining Jobs can be placed in the dataPacksJobs folder or in the folder for your project. They are YAML files which specify what will happen when the job is run. They are similar to a Salesforce package.xml file, however they also contain additional options for the job when it is run. 

**For a full example file with notes see dataPacksJobs/ReadMe-Example.yaml**

#### Settings 
##### Basic  
```yaml
projectPath: ../my-project # Where the project will be contained. Use . for this folder. The Path is always relative to the vlocity_build folder, not this yaml file
expansionPath: datapack-expanded # The Path relative to the projectPath to insert the expanded files. Also known as the DataPack Directory in this Doecumentation
```

##### Export 
Exports can be setup as a series of queries or a manifest. 

##### Export by Queries
Queries support full SOQL to get an Id for each DataPackType. You can have any number of queries in your export. SOQL Queries can use %vlocity_namespace%__ to be namespace independent or the namespace of your Vlocity Package can be used.

```yaml
queries:
  - VlocityDataPackType: VlocityUITemplate
    query: Select Id from %vlocity_namespace%__VlocityUITemplate__c where Name LIKE 'campaign%'
```    

##### Export by Manifest
The manifest defines the Data used to export. Not all types will support using a manifest as many types are only unique by their Id. VlocityDataPackTypes that are unique by name will work for manifest.

```yaml
manifest: 
  VlocityCard:
    - Campaign-Story 
  OmniScript: 
    - Type: Insurance 
      Sub Type: Billing 
      Language: English
```

Additionally, an Export Build File can be created as part of an Export. It is a single file with all of the exported DataPack Data in it. This file is not Importable to a Salesforce Org. Use the BuildFile task to create an Importable file.

```yaml
exportBuildFile: exportFile/exportFile.json
```

##### BuildFile  
This specifies a File to create from the DataPack Directory
```yaml
buildFile: staticresources/CampaignBaseTemplates.resource 
```

##### Export Single
You can export a single DataPack and all its dependencies with packExportSingle. It also supports only exporting the single DataPack with no dependencies by setting the depth.
```bash
grunt -job JOB_NAME packExportSingle -type DATA_PACK_TYPE -id SALESFORCE_ID -depth MAX_DEPTH
```
Max Depth is optional and a value of 0 will only export the single DataPack. Max Depth of 1 will export the single DataPack along with its first level depedencies.



##### Anonymous Apex  
You can run Anonymous Apex before and After a Job by job type and before each step of a Deploy. Available types are Import, Export, Deploy, BuildFile, and ExpandFile. Apex files live in vlocity_build/apex. You can include multiple Apex files with "//include FileName.cls;" in your .cls file.

```yaml
preJobApex:
  Deploy: DeactivateTemplatesAndLayouts.cls  
```

With this setting, the Apex Code in DeativateTemplatesAndLayouts.cls will run before the deploy to the org. In this case it will Deactivate the Vlocity Templates and Vlocity UI Layouts (Cards) associated with the Deploy. See Advanced Anonymous Apex for more details.

##### Additional Options 
The Job file additionally supports some Vlocity Build based options and the options available to the DataPacks API.

##### Vlocity Build 
| Option | Description | Type  | Default |
| ------------- |------------- |----- | -----|
| compileOnBuild  | Compiled files will not be generated as part of this Export. Primarily applies to SASS files currently | Boolean | false |
| manifestOnly | If true, an Export job will only save items specifically listed in the manifest |   Boolean | false |
| delete | Delete the VlocityDataPack__c file on finish   |    Boolean | true |
| activate | Will Activate everything after it is imported / deployed | Boolean | false |
| maximumDeployCount | The maximum number of items in a single Deploy. Setting this to 1 combined with using preStepApex can allow Deploys that act against a single DataPack at a time | Integer | 1000
| defaultMaxParallel | The number of parallel processes to use for export | Integer | 1
| exportPacksMaxSize | Split DataPack export once it reaches this threshold | Integer | null | 
| continueAfterError | Don't end grunt job on error | Boolean | false |

##### DataPacks API
| Option | Description | Type  | Default |
| ------------- |------------- |----- | -----|
| ignoreAllErrors | Ignore Errors during Job | Boolean | false |
| maxDepth | The max distance of Parent or Children Relationships from initial data being exported | Integer | -1 |
| processMultiple | When false each Export or Import will run individually | Boolean | true |

Supported DataPack Types
-----------------------
These types are what would be specified when creating a Query or Manifest for the Job. 

#### Supported for General Audiences
| VlocityDataPackType | SObject | Label |
| ------------- |-------------| ----- | 
| Attachment | Attachment | Attachment | 
| AttributeAssignmentRule | AttributeAssignmentRule__c | Attribute Assignment Rule | 
| AttributeCategory | AttributeCategory__c | Attribute Category | 
| CalculationMatrix | CalculationMatrix__c | Calculation Matrix | 
| CalculationProcedure | CalculationProcedure__c | Calculation Procedure | 
| ContextAction | ContextAction__c | Context Action | 
| ContextDimension | ContextDimension__c | Vlocity Context Dimension | 
| ContextScope | ContextScope__c | Context Scope | 
| ContractType | ContractType__c | Contract Type | 
| DataRaptor | DRBundle__c | DataRaptor Interface | 
| Document | Document | Document (Salesforce Standard Object) | 
| DocumentClause | DocumentClause__c | Document Clause | 
| DocumentTemplate | DocumentTemplate__c | Document Template | 
| EntityFilter | EntityFilter__c | Entity Filter | 
| ItemImplementation | ItemImplementation__c | Item Implementation | 
| ManualQueue | ManualQueue__c | Manual Queue | 
| ObjectClass | ObjectClass__c | Object Layout | 
| ObjectContextRule | ObjectRuleAssignment__c | Vlocity Object Rule Assignment | 
| ObjectLayout | ObjectLayout__c | Object Layout | 
| OmniScript | OmniScript__c | OmniScript | 
| OrchestrationDependencyDefinition | OrchestrationDependencyDefinition__c | Orchestration Dependency Definition | 
| OrchestrationItemDefinition | OrchestrationItemDefinition__c | Orchestration Item Definition | 
| OrchestrationPlanDefinition | OrchestrationPlanDefinition__c | OrchestrationPlanDefinition__c | 
| Pricebook2 | Pricebook2 | Pricebook (Salesforce Standard Object) | 
| PriceList | PriceList__c | Price List | 
| PricingVariable | PricingVariable__c | Pricing Variable | 
| Product2 | Product2 | Product (Salesforce Standard Object) | 
| Promotion | Promotion__c | Promotion | 
| QueryBuilder | QueryBuilder__c | Query Builder | 
| Rule | Rule__c | Rule | 
| StoryObjectConfiguration | StoryObjectConfiguration__c | Story Object Configuration (Custom Setting) | 
| System | System__c | System | 
| TimePlan | TimePlan__c | Time Plan | 
| TimePolicy | TimePolicy__c | Time Policy | 
| UIFacet | UIFacte__c | UI Facet | 
| UISection | UISection__c | UI Section | 
| VlocityAction | VlocityAction__c | Vlocity Action | 
| VlocityAttachment | VlocityAttachment__c | Vlocity Attachment | 
| VlocityCard | VlocityCard__c | Vlocity Card | 
| VlocityFunction | VlocityFunction__c | Vlocity Function | 
| VlocityPicklist | Picklist__c | Vlocity Picklist | 
| VlocitySearchWidgetSetup | VlocitySearchWidgetSetup__c | Vlocity Interaction Launcher | 
| VlocityStateModel | VlocityStateModel__c | Vlocity State Model | 
| VlocityUILayout | VlocityUILayout__c | Vlocity UI Layout | 
| VlocityUITemplate | VlocityUITemplate__c | Vlocity UI Template | 
| VqMachine | VqMachine__c | Vlocity Intelligence Machine | 
| VqResource | VqResource__c | Vlocity Intelligence Resource | 

Advanced Anonymous Apex
---------------------
In order to make the Anonymour Apex part reusable, you can include multiple Apex files with "//include FileName.cls;" in your .cls file. This allows you to write Utility files that can be reused. The BaseUtilities.cls file includes an additional feature that will send the data as a JSON to your Anonymous Apex.

#### Namespace
In Anonymous apex vlocity_namespace will be replaced with the vlocity.namespace from the propertyfile.

#### BaseUtilities.cls 
```java
List<Object> dataSetObjects = (List<Object>)JSON.deserializeUntyped('CURRENT_DATA_PACKS_CONTEXT_DATA');

List<Map<String, Object>> dataPackDataSet = new List<Map<String, Object>>();

for (Object obj : dataSetObjects)
{
  if (obj != null)
  {
    dataPackDataSet.add((Map<String, Object>)obj);
  }
}
```
The token CURRENT_DATA_PACKS_CONTEXT_DATA will be replaced with JSON data and converted into a List<Map<String, Object>> with data depending on the type of setting and type of job being run.

#### PreJobApex Replacement Format
Pre Job Apex is what runs before the Job.

#### preJobApex vs preStepApex
Anonymous Apex has a total character limit of 32000 characters. Therefore, large projects cannot successfully run preJobApex against the entire project. Instead, preStepApex will send only the DataPack context data for the currently running API call. 

For Deploys, this means that instead of Deactivating all Templates and Layouts for an entire project before beginning a full deploy, using the same provided DeactivateTemplatesAndLayouts.cls as preStepApex, the target Salesforce Org will be minimally impacted as each Template or Card will only be Deactivated while it is being deployed. Best when combined with the maximumDeployCount of 1. 

Currently preStepApex is only supported for Deploy, but additional job types and postStepApex functionality will follow in time.

##### Export by Manifest
If Exporting with a Manifest, each JSON Object will be one entry in the Manifest in the form of:
```yaml
manifest:
  VlocityCard: 
    - Campaign-Story 
```
```json
{
    "VlocityDataPackType": "VlocityCard",
    "Id": "Campaign-Story"
}
```
"Id" is the default JSON key in the Manifest, but Manifests also support YAML Key/Value pair syntax:
```yaml
manifest: 
  OmniScript: 
    - Type: Insurance 
      SubType: Billing
      Language: English
```
Which becomes:
```json
{
    "VlocityDataPackType": "VlocityCard",
    "Type": "Insurance",
    "SubType": "Billing",
    "Language": "English"
}
```
##### Export by Queries
For a Query, each result from the Query will be a JSON Object with the appropriate DataPack Type.
```yaml
queries: 
  - VlocityDataPackType: VlocityUITemplate 
    query: Select Id from %vlocity_namespace%__VlocityUITemplate__c where Name LIKE 'campaign%' # SOQL 
```
Becomes:
```json
{
    "VlocityDataPackType": "VlocityUITemplate",
    "Id": "01r61000000DeTeAAN",
}
```
##### Deploy
Before a Deploy, each JSON Object will be a small amount of information about the Object. By default it is the Name of the Object. For a VlocityUILayout it would be:
```json
{
    "VlocityDataPackType": "VlocityUILayout",
    "Name": "Campaign-Story"
}
```
In the DeactivateTemplatesAndLayouts.cls this Name is used to Deactivate the Layouts that are pending for Deploy.
#### PostJobApex Replacement Format
Post Job Apex runs after the Job completes successfully.
##### Deploy
After a Deploy the Ids of every record deployed will be in the JSON Object List. This may be too much data for Anonymous Apex for large deploys.
```json
{
    "Id": "01r61000000DeTeAAN"
}
```
