//include BaseUtilities.cls;

List<String> allTemplateNames = new List<String>();
List<String> allLayoutNames = new List<String>();

for (Map<String, Object> obj : dataPackDataSet)
{
	if (obj.get('VlocityRecordSObjectType') == '%vlocity_namespace%__VlocityUITemplate__c')
	{
		allTemplateNames.add((String)obj.get('Name'));
	}

	if (obj.get('VlocityRecordSObjectType') == '%vlocity_namespace%__VlocityUILayout__c')
	{
		allLayoutNames.add((String)obj.get('Name'));
	}
}

List<vlocity_namespace__VlocityUITemplate__c> templates = [SELECT Id, Name, %vlocity_namespace%__Active__c FROM %vlocity_namespace%__VlocityUITemplate__c WHERE Name in :allTemplateNames OR Name LIKE 'TZ_%'];

for (vlocity_namespace__VlocityUITemplate__c temp : templates)
{
	temp.vlocity_namespace__Active__c = false;
}

if (templates.size() > 0)
{
	update templates;
}

List<vlocity_namespace__VlocityUILayout__c> layouts = [SELECT Id, Name, %vlocity_namespace%__Active__c FROM %vlocity_namespace%__VlocityUILayout__c WHERE Name in :allLayoutNames OR Name LIKE 'TZ_%'];

for (vlocity_namespace__VlocityUILayout__c layout : layouts)
{
	layout.vlocity_namespace__Active__c = false;
}

if (layouts.size() > 0)
{
	update layouts;
}


