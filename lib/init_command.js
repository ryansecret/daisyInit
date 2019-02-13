'use strict';

const fs = require('fs');
const fse = require('fs-extra')
const path = require('path');
const mkdirp = require('mkdirp');
const inquirer = require('inquirer');
const yargs = require('yargs');
const ProxyAgent = require('proxy-agent');
const download = require('download-git-repo')
const ora = require('ora')
const rimraf=require("rimraf");

require('colors');

module.exports = class Command {
  constructor(options) {
    options = options || {};
    this.name = options.name || 'daisy-init';

    this.inquirer = inquirer;

  }

  * run(cwd, args) {
    const argv = this.argv = this.getParser().parse(args || []);
    this.cwd = cwd;
    console.log('%j', argv);

    const proxyHost = process.env.http_proxy || process.env.HTTP_PROXY;
    if (proxyHost) {
      const proxyAgent = new ProxyAgent(proxyHost);
      this.httpClient.agent = proxyAgent;
      this.httpClient.httpsAgent = proxyAgent;
      this.log(`use http_proxy: ${proxyHost}`);
    }

    // ask for target dir
     this.targetDir = yield this.getTargetDirectory();


      const answer = yield this.inquirer.prompt({
          name: 'projectName',
          message: 'Please enter project name: ',
          default: 'console',
      });

      // download boilerplate
      yield this.download(this.targetDir);

     let processFiles=["package.json","server/package.json","client/package.json"]

     for (let file of processFiles)
     {
         let pkgPath=path.join(this.targetDir,file)
         let pkg= yield  fse.readJson(pkgPath, { throws: false })
         pkg=JSON.stringify(pkg,null,2).replace(/mndb/g,answer.projectName)
         fs.writeFileSync(pkgPath, pkg)
     }
     let yunYiPath=path.join(this.targetDir,"/yunyi/bin/control")
     let control= fs.readFileSync(yunYiPath,"utf-8").replace(/mndb/g,answer.projectName)
      fs.writeFileSync(yunYiPath, control)
      //       // done
    this.printUsage(this.targetDir);
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
      origin:{
          type:'string',
          description:'模板的远程地址'
      },
      branch:{
          type:'string',
          description:'模板的分支',
          default:'#master'
      }
    };
  }


  /**
   * ask for target directory, will check if dir is valid.
   * @return {String} Full path of target directory
   */
  * getTargetDirectory() {
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
        return `${dir} already exists and not empty: ${JSON.stringify(files)}`.red;
      }
      return true;
    };

    // if argv dir is invalid, then ask user
    const isValid = validate(targetDir);
    if (isValid !== true) {
      this.log(isValid);
      const answer = yield this.inquirer.prompt({
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
    this.log(`usage:
      - cd ${this.targetDir}
      - npm install
      - npm start / npm run dev / npm test
    `);
  }

    * download(targetPath, projectName) {
    try {
        fse.removeSync(targetPath)

        let origin = `direct:${this.argv.origin}`||`gitlab:git.jd.com:daasfe/mndb`
        let branch =`${this.argv.branch}` || 'template'

        const spinner = ora('downloading template...')
        spinner.start()
        yield this.promiseDownload(`${origin}#${branch}`,targetPath,projectName)
        spinner.stop()
        this.log("download tempalte finish")
    }
    catch (e) {
       this.log("download tempalte failed",e)
    }

    }

    promiseDownload(url,targetPath)
    {
      return new Promise((re,rj)=>{
          download(url,targetPath , { clone: true },err=>{
            if(err)
              rj(err)
            re()
          })
      })
    }

  /**
   * log with prefix
   */
  log() {
    const args = Array.prototype.slice.call(arguments);
    args[0] = `[${this.name}] `.blue + args[0];
    console.log.apply(console, args);
  }
};
