# Authentication API

<details>
  <summary><strong>Table of Contents</strong></summary>

  * [Query](#query)
  * [Mutation](#mutation)
  * [Objects](#objects)
    * [AuthResponse](#authresponse)
    * [Local](#local)
    * [Session](#session)
    * [Sso](#sso)
    * [Stage](#stage)
    * [User](#user)
    * [UserOps](#userops)
  * [Inputs](#inputs)
    * [Creds](#creds)
  * [Enums](#enums)
    * [Code](#code)
    * [Provider](#provider)
  * [Scalars](#scalars)
    * [Boolean](#boolean)
    * [ID](#id)
    * [String](#string)
  * [Interfaces](#interfaces)
    * [AuthOps](#authops)

</details>

## Query
<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>ping</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td>ping the api</td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>stage</strong></td>
<td valign="top"><a href="#stage">Stage</a>!</td>
<td>return the current auth version</td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>cert</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td>return the public signing key</td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>me</strong></td>
<td valign="top"><a href="#user">User</a>!</td>
<td>return the authenticated user</td>
</tr>
</tbody>
</table>

## Mutation
<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>authenticate</strong></td>
<td valign="top"><a href="#authops">AuthOps</a>!</td>
<td>authentication operations</td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>me</strong></td>
<td valign="top"><a href="#userops">UserOps</a>!</td>
<td>user operations</td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>refreshMe</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td>simply refresh the accessToken by checking the refresh Token stored by the auth in a cookie</td>
</tr>
</tbody>
</table>

## Objects

### AuthResponse

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>user</strong></td>
<td valign="top"><a href="#user">User</a>!</td>
<td>the authenticated user</td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>newAccount</strong></td>
<td valign="top"><a href="#boolean">Boolean</a>!</td>
<td>wether or not the operation was a registration</td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>newSession</strong></td>
<td valign="top"><a href="#boolean">Boolean</a>!</td>
<td>wether or not the operation created a new session</td>
</tr>
</tbody>
</table>

### Local

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>signin</strong></td>
<td valign="top"><a href="#authresponse">AuthResponse</a>!</td>
<td>create / retrieve and fix an user session (refreshToken)</td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">creds</td>
<td valign="top"><a href="#creds">Creds</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signup</strong></td>
<td valign="top"><a href="#authresponse">AuthResponse</a>!</td>
<td>create and fix an user session (refreshToken)</td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">creds</td>
<td valign="top"><a href="#creds">Creds</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signout</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td>destroy the cookies and delete the session</td>
</tr>
</tbody>
</table>

### Session

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>ip</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>browserName</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>osName</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>deviceModel</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>deviceType</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>deviceVendor</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
</tbody>
</table>

### Sso

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>sign</strong></td>
<td valign="top"><a href="#authresponse">AuthResponse</a>!</td>
<td>create and fix an user session (refreshToken)</td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">provider</td>
<td valign="top"><a href="#provider">Provider</a>!</td>
<td>GOOGLE|TWITTER|FACEBOOK|GITHUB (only google supported in this version)</td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">idToken</td>
<td valign="top"><a href="#string">String</a>!</td>
<td>sso token (refer to the provider doc)</td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>signout</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td>destroy the cookies and delete the session</td>
</tr>
</tbody>
</table>

### Stage

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>stage</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>version</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### User

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>id</strong></td>
<td valign="top"><a href="#id">ID</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>sessions</strong></td>
<td valign="top">[<a href="#session">Session</a>!]!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>verified</strong></td>
<td valign="top"><a href="#boolean">Boolean</a>!</td>
<td></td>
</tr>
</tbody>
</table>

### UserOps

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>sendCode</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td>notify aws SNS in order to send a email to perform different actions like creating a code to reset the password</td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">code</td>
<td valign="top"><a href="#code">Code</a>!</td>
<td>RESET_PWD|CONFIRM_EMAIL</td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">email</td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>resetPassword</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td>reset the password with the code provided in the email by the query up there</td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">email</td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">newPwd</td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">resetCode</td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>confirmEmail</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td>validate the user account with the code retrieved in the email</td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">code</td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>inviteUser</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td>create an account for a third party, it will also notify SNS to send a email with a `reset password code` in order to allow the created user to choose his password</td>
</tr>
<tr>
<td colspan="2" align="right" valign="top">email</td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
</tbody>
</table>

## Inputs

### Creds

<table>
<thead>
<tr>
<th colspan="2" align="left">Field</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>email</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>pwd</strong></td>
<td valign="top"><a href="#string">String</a>!</td>
<td></td>
</tr>
<tr>
<td colspan="2" valign="top"><strong>rememberMe</strong></td>
<td valign="top"><a href="#boolean">Boolean</a></td>
<td>If set to false the cookie will expire when the navigator session end (refer to your current navigator definition of session)</td>
</tr>
</tbody>
</table>

## Enums

### Code

<table>
<thead>
<th align="left">Value</th>
<th align="left">Description</th>
</thead>
<tbody>
<tr>
<td valign="top"><strong>RESET_PWD</strong></td>
<td></td>
</tr>
<tr>
<td valign="top"><strong>CONFIRM_EMAIL</strong></td>
<td></td>
</tr>
</tbody>
</table>

### Provider

<table>
<thead>
<th align="left">Value</th>
<th align="left">Description</th>
</thead>
<tbody>
<tr>
<td valign="top"><strong>GOOGLE</strong></td>
<td></td>
</tr>
</tbody>
</table>

## Scalars

### Boolean

The `Boolean` scalar type represents `true` or `false`.

### ID

The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.

### String

The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.


## Interfaces


### AuthOps

<table>
<thead>
<tr>
<th align="left">Field</th>
<th align="right">Argument</th>
<th align="left">Type</th>
<th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2" valign="top"><strong>signout</strong></td>
<td valign="top"><a href="#string">String</a></td>
<td></td>
</tr>
</tbody>
</table>
