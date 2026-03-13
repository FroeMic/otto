# OTTO Architecture

## What?

Otto is a startup which provisions agents for it's customers

It consists of:
1. a control plane service ( "web" )
2. an agent runtime
3. a VPS server per customer which runs the runtime


## How?

The "web" service serves a website for the end users. Here, they can create an
account, login and request an agent for themselves.

The "web" service then provisiones a VPS for them and starts the agent on it.
The user then interacts with the agent via a messaging channel (e.g. Slack).

### Directory structure

* `web`: nexjs application

