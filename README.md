# Memory Hub

Memory Hub é uma aplicação para gerenciamento de eventos contextuais nos projetos. Os principais componentes incluem:

- **MCP**: Gerenciamento de eventos locais por projeto.
- **Daemon**: Centralização de dados, API e triggers.
- **Frontend**: Interface para exibição e gerenciamento dos eventos.

### Estrutura
- `memory.json` por projeto (salvos em `.cursor-memory/`).
- Banco de dados SQLite global..