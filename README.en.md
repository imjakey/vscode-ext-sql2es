# SQL to Elasticsearch Converter

This is a VSCode extension that converts selected SQL text into Elasticsearch queries.

## Multi-language Support

This extension supports multiple languages and will automatically select the display language based on VSCode's current language. Currently supported languages:

- English (default)
- Chinese (Simplified)

If you are using another language, the extension will default to English.

## Features

1. Convert SQL queries to Elasticsearch Query DSL
2. Convert SQL queries to Elasticsearch curl commands
3. Supports multiple usage methods:
   - Execute conversion via command palette
   - Convert selected SQL text via right-click menu
4. Automatic formatting of conversion results
5. Configurable AI model parameters
6. Multi-language support (English and Chinese)
7. Conversion history feature:
   - Automatically save conversion records
   - View historical conversion records
   - Perform operations like copy, insert, view on historical records
   - Clear conversion history

## Installation

1. Install this extension in VSCode
2. Configure the API key and other parameters for the AI model in the extension settings

## Usage

### Configuration

Before using the extension, you need to configure the following parameters:

1. `sql2es.apiKey` - API key for the AI model service
2. `sql2es.apiEndpoint` - Endpoint URL for the AI model service (defaults to OpenAI)
3. `sql2es.model` - Name of the AI model to use
4. `sql2es.esVersion` - Elasticsearch version (defaults to 7.x)
5. `sql2es.esUsername` - Elasticsearch username, used for authentication parameters in curl commands
6. `sql2es.esPassword` - Elasticsearch password

### Converting SQL Queries

There are three ways to convert SQL queries:

1. **Command Palette Method** (Convert to DSL):
   - Open a file containing SQL queries
   - Press `Ctrl+Shift+P` to open the command palette
   - Type "SQL2Es: Convert SQL to Elasticsearch DSL" and execute

2. **Right-click Menu Method** (Convert to DSL):
   - Select the text to convert in a SQL file
   - Right-click on the selected text
   - Choose "SQL2Es: Convert Selected SQL to Elasticsearch DSL"

3. **Right-click Menu Method** (Convert to curl command):
   - Select the text to convert in a SQL file
   - Right-click on the selected text
   - Choose "SQL2Es: Convert Selected SQL to Elasticsearch Curl Command"

The conversion result will be inserted directly on the line below the original SQL, including the correct HTTP method and API path, as well as the formatted Elasticsearch Query DSL or curl command.

## Supported AI Models

This extension supports any model compatible with the OpenAI API, including:

- OpenAI's GPT series models
- Azure OpenAI Service
- Other third-party services compatible with the OpenAI API

## Notes

- A valid API key is required to use this extension
- Conversion quality depends on the AI model being used
- Ensure a stable network connection to access the AI model API