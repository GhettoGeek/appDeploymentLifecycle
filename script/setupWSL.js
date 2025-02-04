// execute through `setupWSL.sh` shell file.

const childProcess = require('child_process')
import path from 'path'
import operatingSystem from 'os'
import assert from 'assert'
import { copyFile } from '@dependency/deploymentScript/source/utility/filesystemOperation/copyFile.js'
import { isRootPermission } from '@dependency/deploymentScript/source/utility/isElevatedPermission.js'
import { readInput } from '@dependency/deploymentScript/source/utility/readInput.js'
import { install as installDocker } from '@dependency/deploymentScript/script/provisionOS/installUnixPackage/installDocker.js'
import { install as installGit } from '@dependency/deploymentScript/script/provisionOS/installUnixPackage/installGit.js'
import { install as installShellZsh } from '@dependency/deploymentScript/script/provisionOS/installUnixPackage/installShellZsh.js'
import { install as installYarn } from '@dependency/deploymentScript/script/provisionOS/installUnixPackage/installYarn.js'
import { install as installJSPM } from '@dependency/deploymentScript/script/provisionOS/installUnixPackage/installJSPM.js'

assert(
  operatingSystem
    .platform()
    .toLowerCase()
    .includes('linux'),
  `• This script must be run in WSL (wsl.exe), not Windows OS.`,
)
console.log(`• Executing on unix user "${operatingSystem.userInfo().username}"`)

export const nonElevatedCallback = () => {
  assert(!isRootPermission(), `• Must run as non-root, in which it will be eleveated in a separate process.`)
  const userFolder = operatingSystem.homedir()
  /*
    ___           _        _ _   ____            _                         
   |_ _|_ __  ___| |_ __ _| | | |  _ \ __ _  ___| | ____ _  __ _  ___  ___ 
    | || '_ \/ __| __/ _` | | | | |_) / _` |/ __| |/ / _` |/ _` |/ _ \/ __|
    | || | | \__ \ || (_| | | | |  __/ (_| | (__|   < (_| | (_| |  __/\__ \
    |_|_| |_|___/\__\__,_|_|_| |_|   \__,_|\___|_|\_\__,_|\__, |\___||___/
                                                          |___/           
  */
  installDocker()
  installGit()
  installShellZsh()
  installYarn()
  installJSPM()

  /*
      ____             __ _                       _   _               _____ _ _           
    / ___|___  _ __  / _(_) __ _ _   _ _ __ __ _| |_(_) ___  _ __   |  ___(_) | ___  ___ 
    | |   / _ \| '_ \| |_| |/ _` | | | | '__/ _` | __| |/ _ \| '_ \  | |_  | | |/ _ \/ __|
    | |__| (_) | | | |  _| | (_| | |_| | | | (_| | |_| | (_) | | | | |  _| | | |  __/\__ \
    \____\___/|_| |_|_| |_|\__, |\__,_|_|  \__,_|\__|_|\___/|_| |_| |_|   |_|_|\___||___/
                            |___/                                                         
    copy configuration files to WSL filesystem
  */
  // set git profile information:
  let email = childProcess.execSync('git config --system user.email', { silent: true, encoding: 'utf8' })
  if (!email) readInput().then(email => childProcess.execSync(`sudo git config --system user.email ${email}`, { silent: true, encoding: 'utf8' }))
  let name = childProcess.execSync('git config --system user.name', { silent: true, encoding: 'utf8' })
  if (!name) readInput().then(name => childProcess.execSync(`sudo git config --system user.name ${name}`, { silent: true, encoding: 'utf8' }))

  copyFile([
    {
      source: path.resolve(__dirname, '../resource/localOSEnvironment/WSL/.gitconfig'),
      get destination() {
        return path.join(userFolder, path.basename(this.source))
      },
    },
    {
      source: path.resolve(__dirname, '../resource/localOSEnvironment/WSL/shell/bash/.bashrc'),
      get destination() {
        return path.join(userFolder, path.basename(this.source))
      },
    },
    {
      source: path.resolve(__dirname, '../resource/localOSEnvironment/WSL/shell/zsh/.zshrc'),
      get destination() {
        return path.join(userFolder, path.basename(this.source))
      },
    },
    {
      source: path.resolve(__dirname, '../resource/localOSEnvironment/WSL/shell/zsh/powerlevel9k.zsh-theme'),
      get destination() {
        return path.join(userFolder, '.oh-my-zsh/custom/themes/powerlevel10k/', path.basename(this.source))
      },
    },
  ])

  runElevatedSection()
}

export const elevatedCallback = () => {
  // 2nd argument passed to indicate trigger by child process.
  assert(process.argv[2], `• Script must be directly initialized as non root (non-elevated) process.`)
  assert(isRootPermission(), `• Must run with root permissions.`)
  // NOTE: requires root permission for copying the file through js script.
  copyFile([
    {
      source: path.resolve(__dirname, '../resource/localOSEnvironment/WSL/wsl.conf'),
      get destination() {
        return path.join('/etc/', path.basename(this.source))
      },
    },
  ])
}

function runElevatedSection() {
  // re-run script with eleveated permissions (root) to allow the sections requiring permissions to be executed separately as well (non eleveated code section relies on the non-root username to run successfully.).
  // Allows to run an elevated section of code in the same file, through spinning a new process that has elevated permission and conditionally choosing the section to run.
  console.log('• Elevating permissions for running sections requiring root...')
  childProcess.spawnSync(
    `sudo`,
    [`yarn run scriptManager shouldCompileScript=true`, path.basename(process.argv[1]), '".elevatedCallback()"', '-', true /** indicates that this is a child process */],
    { cwd: __dirname, shell: true, stdio: [0, 1, 2] },
  )
}
