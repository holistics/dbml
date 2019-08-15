import program from 'commander';
import importHandler from './import';
import exportHandler from './export';
import visualizeHandler from './visualize';
import projectInfo from '../../package.json';

export default function cli (args) {
  program.version(projectInfo.version);

  program
    .command('import <pathspec>')
    .option('--mysql')
    .option('--postgres')
    .option('--json')
    .option('--schemarb')
    .option('-o, --output <pathspec>', 'Generated file location', './')
    .action(importHandler);

  program
    .command('export <pathspec>')
    .option('--mysql')
    .option('--postgres')
    .option('--json')
    .option('-o, --output <pathspec>', 'Exported file location', './')
    .action(exportHandler);

  program
    .command('visualize <pathspec> [otherPathspec...]')
    .action(visualizeHandler);

  program.on('command:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
    process.exit(1);
  });

  program.parse(args);
}
