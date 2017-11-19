// Clean up actions before a deployment
delete [SELECT Id FROM %vlocity_namespace%__Rule__c];
delete [SELECT Id FROM %vlocity_namespace%__RuleAction__c];