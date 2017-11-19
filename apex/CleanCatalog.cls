// Clean up actions before a deployment
delete [SELECT Id FROM %vlocity_namespace%__Catalog__c];
delete [SELECT Id FROM %vlocity_namespace%__CatalogProductRelationship__c];