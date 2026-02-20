import dotenv from 'dotenv';
import fs from 'fs';

import { EnvVars, envSchema } from './env-schema';

const NODE_ENV = process.env.NODE_ENV ?? 'development';

// Load local env files when present. In hosted envs (e.g. Render), you typically
// set environment variables in the dashboard and won't have a .env file on disk.
const candidateEnvFiles =
  NODE_ENV === 'development'
    ? [`.env.${NODE_ENV}`, '.env.dev', '.env']
    : [`.env.${NODE_ENV}`, '.env'];

const envFileToLoad = candidateEnvFiles.find(file => fs.existsSync(file));
if (envFileToLoad) {
  dotenv.config({ path: envFileToLoad });
  console.log(`[env] Loaded ${envFileToLoad} (NODE_ENV=${NODE_ENV})`);
} else {
  console.warn(
    `[env] No local .env file found (${candidateEnvFiles.join(', ')}). Using process.env only.`,
  );
}

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.format();
  const missingKeys = Object.keys(formattedErrors).filter(key => key !== '_errors');

  console.error(
    `[env] Missing required environment variables (NODE_ENV=${NODE_ENV}):\n${missingKeys.join(', ')}`,
  );
  process.exit(1);
}

console.log(`[env] Environment validated (NODE_ENV=${NODE_ENV})`);

export const env: EnvVars = parsedEnv.data;

const definedEnvKeys = Object.keys(process.env);
const allowedKeys = Object.keys(envSchema.shape);

const systemVars = new Set([
  'ACLOCAL_PATH',
  'ALLUSERSPROFILE',
  'APPDATA',
  'COLOR',
  'COMMONPROGRAMFILES',
  'CommonProgramFiles(x86)',
  'CommonProgramW6432',
  'COMPUTERNAME',
  'COMSPEC',
  'IGCCSVC_DB',
  'CONFIG_SITE',
  'DISPLAY',
  'DriverData',
  'EDITOR',
  'EXEPATH',
  'HOME',
  'HOMEDRIVE',
  'HOMEPATH',
  'HOSTNAME',
  'INFOPATH',
  'INIT_CWD',
  'LANG',
  'LOCALAPPDATA',
  'LOGONSERVER',
  'MANPATH',
  'MINGW_CHOST',
  'MINGW_PACKAGE_PREFIX',
  'MINGW_PREFIX',
  'MSYS',
  'MSYSTEM',
  'MSYSTEM_CARCH',
  'MSYSTEM_CHOST',
  'MSYSTEM_PREFIX',
  'NODE',
  'NUMBER_OF_PROCESSORS',
  'NVM_HOME',
  'NVM_SYMLINK',
  'OLDPWD',
  'OneDrive',
  'OneDriveConsumer',
  'ORIGINAL_PATH',
  'ORIGINAL_TEMP',
  'ORIGINAL_TMP',
  'OS',
  'PATH',
  'PATHEXT',
  'PKG_CONFIG_PATH',
  'PKG_CONFIG_SYSTEM_INCLUDE_PATH',
  'PKG_CONFIG_SYSTEM_LIBRARY_PATH',
  'PLINK_PROTOCOL',
  'PROCESSOR_ARCHITECTURE',
  'PROCESSOR_IDENTIFIER',
  'PROCESSOR_LEVEL',
  'PROCESSOR_REVISION',
  'ProgramData',
  'PROGRAMFILES',
  'ProgramFiles(x86)',
  'ProgramW6432',
  'PROMPT',
  'PSModulePath',
  'PUBLIC',
  'PWD',
  'SESSIONNAME',
  'SHELL',
  'SHLVL',
  'SSH_ASKPASS',
  'SYSTEMDRIVE',
  'SYSTEMROOT',
  'TEMP',
  'TERM',
  'TMP',
  'TMPDIR',
  'USERDOMAIN',
  'USERDOMAIN_ROAMINGPROFILE',
  'USERNAME',
  'USERPROFILE',
  'WINDIR',
  'WSLENV',
  'WT_PROFILE_ID',
  'WT_SESSION',
  'ZES_ENABLE_SYSMAN',
  '_',
]);

const extraKeys = definedEnvKeys.filter(
  key =>
    !allowedKeys.includes(key) &&
    !systemVars.has(key) &&
    !key.startsWith('npm_') &&
    !key.startsWith('MSYSTEM') &&
    !key.startsWith('MINGW') &&
    !key.startsWith('WT_'),
);

if (extraKeys.length > 0) {
  console.warn(`[env] Unused environment variables detected: ${extraKeys.join(', ')}`);
}
