// Clean up actions before a deployment
delete [SELECT Id FROM %vlocity_namespace%__VlocityAction__c WHERE %vlocity_namespace%__IsSeedAction__c = false];