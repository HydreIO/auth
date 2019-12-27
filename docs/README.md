![][licence]

<h1 align=center>@hydre/auth</h1>

[![][discord]][discordlink] [![][twitter]][twitterlink]

[licence]: https://img.shields.io/github/license/HydreIO/doubt.svg?style=for-the-badge
[twitter]: https://img.shields.io/badge/follow-us-blue.svg?logo=twitter&style=for-the-badge
[twitterlink]: https://twitter.com/hydreio
[discord]: https://img.shields.io/discord/398114799776694272.svg?logo=discord&style=for-the-badge
[discordlink]: https://discord.gg/bRSpRpD

Serverless authentication built on GraphQL for AWS Lambda

> if you need any help feel free to join the discord above to get a fast reply!

**__Navigation__**

* [Home](/)
  * [Requirements](requirements.md)
    * [Locally](requirements.md#Locally)
    * [Production](requirements.md#Production)
  * [Setup](setup.md)
  * [Usage](usage.md)
    * [Usage in development mode](usage.md#Usage-in-development-mode)
    * [Usage in production](usage.md#Usage-in-production)
  * [Implementation](implem.md)
    * [Implementation details](implem.md#Implementation-details)
    * [Server verification](implem.md#Server-verification)
    * [Flow](implem.md#Flow)
    * [Errors handling](implem.md#errors-handling)
* [Queries](queries/)
  * [ping](queries/#ping)
  * [cert](queries/#cert)
  * [stage](queries/#stage)
  * [me](queries/#me)
* [Mutations](mutations/)
  * [signup](mutations/#signup)
  * [signin](mutations/#signin)
  * [sign](mutations/#sign)
  * [signout](mutations/#signout)
  * [refresh](mutations/#refresh)
  * [sendCode](mutations/#sendCode)
  * [inviteUser](mutations/#inviteUser)
  * [confirmEmail](mutations/#confirmEmail)
  * [resetPassword](mutations/#resetPassword)