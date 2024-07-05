# golive-send-release-info action

Use this action to automatically keep your Jira versions/releases up to date when your workflows are building/releasing new version of a Golive application.
Depending on the Jira project(s) associated to each of your application in Golive, this task will automatically:
* create the Jira versions in the right Jira projects
* update the information of the Jira versions (start/release dates, description, status,...)
* add Jira issues to the Jira version using different strategies (eg: static issue keys, JQL, commits parsing)

## What is Apwide Golive for Jira?

Apwide Golive is the game-changing solution for comprehensive test environment management.

Seamlessly integrated with your development and release processes, Apwide Golive empowers your teams to
deliver high-quality software with speed and confidence.
Apwide Golive provides a centralized dashboard for visualizing and tracking environment usage, resource allocation, and availability right in Jira.

With integrated notifications and approvals in Jira, stakeholders stay informed and can provide quick feedback, reducing delays and accelerating the testing
process.

Learn more about Apwide Golive: https://www.apwide.com

## Inputs

(*) required

### goliveToken
Golive API Token
### goliveUrl
Api Base Url.
Default value: `https://golive.apwide.net/api`
### goliveUsername
Golive API Username (Golive Server)
### golivePassword
Golive API Username (Golive Server)
### githubToken (*)
Github token (`${{secrets.GITHUB_TOKEN}}`)
### targetApplicationName
Type the name of the released application.
### targetApplicationId
Select the id of the released application.
### targetAutoCreate
Create the target application with provided name if it does not exist yet in Apwide Golive.
N.B. User associated to your connection must have permission to manage applications in order to automatically create new applications.
### versionName
Name of the current Jira version/release
### versionDescription
Description of the current Jira version/release.
### versionStartDate
Will be set to current date by default. Date in ISO-8601 format. Ex: 2023-09-24T12:00:00Z
### versionReleaseDate
Will be set to current date if the version is marked as "Released". Date in ISO-8601 format. Ex: 2023-10-24T12:00:00Z
### versionReleased
Mark the current Jira version as released. The "Release Date" will be automatically set to current date if not explicitly specified.
### issueKeys
Comma separated list of Issue Keys to add to the current Jira version/release. Ex: ECOM-3412,ECOM-6783,PAY-98
### issueKeysFromCommitHistory
Parse and retrieve the Jira issue keys found in commit history and add issues to the current Jira version/release.
This option requires you to have checked out your repository with `fetch-depth: 0` of the *actions/checkout@v4* action
### issuesFromJql
Set the JQL query used to retrieve and add issues to the current Jira version/release.
Ex: project = ECP AND type in (Story, Bug) AND resolution in (Fixed).
More about JQL [here](https://www.atlassian.com/software/jira/guides/jql)
### sendJiraNotification
Trigger the standard Jira notification when issues are added to the current Jira version/release.

## Outputs
### status
Status of the action.

## Example

### Create version in Jira and link issues present in commits
```yaml
uses: apwide/golive-send-release-info@main
with:
  goliveToken: ${{ secrets.JRE_GOLIVE_TOKEN }}
  githubToken: ${{ secrets.GITHUB_TOKEN }}
  targetApplicationName: 'eCommerce'
  versionName: 'ECOM 2.0.1.1'
  issueKeysFromCommitHistory: true
```

### Full example
Following example is going to:
* create version *ECOM 2.0.1.1* if not exists in project linked to Golive application *eCommerce*
* version will be *released*
* issues from commit messages, hard-coded issueKeys attributes and included in the JQL search will be have their fixVersion updated.
* no Jira notification will be sent for issue updates.

```yaml
uses: apwide/golive-send-release-info@main
with:
  goliveToken: ${{ secrets.JRE_GOLIVE_TOKEN }}
  githubToken: ${{ secrets.GITHUB_TOKEN }}
  applicationName: 'eCommerce'
  versionName: 'ECOM 2.0.1.1'
  versionDescription: 'Ecommerce candidate release'
  versionStartDate: '2023-09-24T12:00:00Z'
  versionReleaseDate: '2023-10-24T12:00:00Z'
  versionReleased: true
  issueKeys: 'ECOM-3412,PAY-102,ECOM-9986'
  issueKeysFromCommitHistory: true
  issuesFromJql: 'project = ECOM and type in (Story, Bug) AND resolution in (Fixed)'
  sendJiraNotification: false
```

## Contact us

We are at your disposal if you have question or need support regarding Apwide Golive and this integration with Github: https://www.apwide.com/support-documentation/
