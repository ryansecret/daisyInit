'use strict';

const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const mkdirp = require('mkdirp');
const inquirer = require('inquirer');
const yargs = require('yargs');
const download = require('download-git-repo');
const ora = require('ora');
const rimraf = require('rimraf');
const execa = require('execa');
const { clearConsole, log, stopSpinner, logWithSpinner } = require('@vue/cli-shared-utils');

require('colors');

module.exports = class Command {
  constructor(options) {
    options = options || {};
    this.name = options.name || 'daisy-init';

    this.inquirer = inquirer;
    this.log = log;

  }

  async run(cwd, args) {
    const argv = this.argv = this.getParser().parse(args || []);
    this.cwd = cwd;
    console.log('%j', argv);
    clearConsole('👉 开始》》》》'.blue);
    // ask for target dir

    this.targetDir = await this.getTargetDirectory();
    const gitInfo = {
      origin: '',
      branch: '',
    };

    let answer = await this.inquirer.prompt({
      type: 'confirm',
      name: 'isCommon',
      message: '是否选择通用模板: ',
      default: false,
    });
    if (answer.isCommon) {
      answer = await this.inquirer.prompt({
        type: 'list',
        name: 'templateType',
        message: '请选择模板类型: ',
        choices: [ 'vue', 'ts', 'node' ],
        default: 'vue',
      });
      gitInfo.origin = 'github.com:ryansecret/tsTemplate';
      switch (answer.templateType) {
        case 'ts':
          gitInfo.branch = 'feature-typeScript';
          break;
        case 'node':
          gitInfo.branch = 'feature-node';
          break;
        case 'vue':
          gitInfo.branch = 'feature-template';
          gitInfo.origin = 'github.com:ryansecret/jdcloud-oss-upload';
        default:
          break;
      }

    } else {
      gitInfo.origin = 'direct:git@coding.jd.com:daas-fe/dms-new-console.git';
      answer = await this.inquirer.prompt({
        type: 'list',
        name: 'templateType',
        message: '请选择模板类型: ',
        choices: [ 'cli3', 'normal' ],
        default: 'cli3',
      });
      switch (answer.templateType) {
        case 'cli3':
          gitInfo.branch = 'feature-vueCli';
          break;
        case 'normal':
          gitInfo.branch = 'template';
          break;
        default:
          break;
      }

    }

    // download boilerplate
    await this.download(this.targetDir, gitInfo);


    log();
    log('📦  Installing additional dependencies...');

    await this.runCommand(this.targetDir, 'npm', [ 'install', '--loglevel', 'error' ]);
    fse.removeSync(path.join(this.targetDir, '.git'));
    log();
    this.log('👉 bingo-----');
    //       // done
    // this.printUsage(this.targetDir);
  }


  /**
   * get argv parser
   * @return {Object} yargs instance
   */
  getParser() {
    return yargs
      .usage('init project from template')
      .options(this.getParserOptions())
      .alias('h', 'help')
      .version()
      .help();
  }

  runCommand(targetDir, command, args) {
    return new Promise((rs, rj) => {
      const child = execa(command, args, { cwd: targetDir, stdio: [ 'inherit', 'inherit', 'inherit' ] });

      child.on('close', code => {
        if (code !== 0) {
          rj(`command failed: ${command} ${args.join(' ')}`);
        }
        rs();
      });
    });


  }

  /**
   * get yargs options
   * @return {Object} opts
   */
  getParserOptions() {
    return {
      dir: {
        type: 'string',
        description: 'target directory',
      },
      force: {
        type: 'boolean',
        description: 'force to override directory',
        alias: 'f',
      },
      silent: {
        type: 'boolean',
        description: 'don\'t ask, just use default value',
      },
      origin: {
        type: 'string',
        description: '模板的远程地址',
      },
      branch: {
        type: 'string',
        description: '模板的分支',
      },
    };
  }


  /**
   * ask for target directory, will check if dir is valid.
   * @return {String} Full path of target directory
   */
  async getTargetDirectory() {
    const dir = this.argv._[0] || this.argv.dir || '';
    let targetDir = path.resolve(this.cwd, dir);
    const force = this.argv.force;

    const validate = dir => {
      // create dir if not exist
      if (!fs.existsSync(dir)) {
        mkdirp.sync(dir);
        return true;
      }

      // not a directory
      if (!fs.statSync(dir).isDirectory()) {
        return `${dir} already exists as a file`.red;
      }

      // check if directory empty
      const files = fs.readdirSync(dir).filter(name => name[0] !== '.');
      if (files.length > 0) {
        if (force) {
          this.log(`${dir} already exists and will be override due to --force`.red);
          return true;
        }
        return `${dir} 当前目录不为空`.red;
      }
      return true;
    };

    // if argv dir is invalid, then ask user
    const isValid = validate(targetDir);
    if (isValid !== true) {
      this.log(isValid);
      const answer = await this.inquirer.prompt({
        name: 'dir',
        message: 'Please enter target dir: ',
        default: dir || '.',
        filter: dir => path.resolve(this.cwd, dir),
        validate,
      });
      targetDir = answer.dir;
    }
    this.log(`target dir is ${targetDir}`);
    return targetDir;
  }

  /**
   * print usage guide
   */
  printUsage() {
    this.log(`👉 usage:
      - cd ${this.targetDir}
      - npm install
      - npm start / npm run dev / npm test
    `);
  }

  async download(targetPath, gitInfo) {
    try {
      fse.removeSync(targetPath);
      const origin = this.argv.origin || gitInfo.origin || 'direct:git@coding.jd.com:daas-fe/dts-new-console.git';
      const branch = this.argv.branch || gitInfo.branch || 'template';

      logWithSpinner('✈️ ', 'downloading template...');
      try {
        await this.promiseDownload(`${origin}#${branch}`, targetPath);
      } catch (e) {
        console.log(e);
      }

      stopSpinner();
      this.log('🎉 download tempalte finish');
    } catch (e) {
      this.log('download tempalte failed', e);
    }

  }

  promiseDownload(url, targetPath) {
    return new Promise((re, rj) => {
      download(url, targetPath, { clone: true }, err => {
        if (err) { rj(err); }
        re();
      });
    });
  }


};
