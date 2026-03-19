#!/usr/bin/env node

import { program } from "commander";
import { configCommand } from "../src/commands/config.js";
import { createCommand } from "../src/commands/create.js";

program
  .name("webhikers")
  .description("CLI for creating and deploying webhikers projects")
  .version("1.0.0");

program
  .command("config")
  .description("Configure Coolify token, server, and SSH credentials")
  .action(configCommand);

program
  .command("create <name>")
  .description("Create a new project from the nextjs-vibe-starter template")
  .action(createCommand);

program.parse();
