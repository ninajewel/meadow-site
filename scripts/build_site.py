"""Build ONLY public interface assets. Never copies database, backups or secrets."""
import argparse
import base64
import json
import os
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1]
FILES=('index.html','style.css','app.js','cloud.js')
def public_config(url,key,repo):
    p=urlsplit(url)
    if p.scheme!='https' or not p.hostname or not re.fullmatch(r'[a-z0-9-]+\.supabase\.co',p.hostname) or p.netloc!=p.hostname or p.path not in ('','/') or p.username or p.password or p.query or p.fragment:
        raise ValueError('Use the HTTPS Supabase project URL, without a path.')
    if not key.startswith('sb_publishable_'):
        try: role=json.loads(base64.urlsafe_b64decode(key.split('.')[1]+'==='))['role']
        except (ValueError,IndexError,KeyError): role=None
        if role!='anon': raise ValueError('Only a publishable or legacy anon key may enter the website. Never use a secret/service-role key.')
    if not re.fullmatch(r'[\w.-]+/[\w.-]+',repo): raise ValueError('Set MEADOW_GENERATOR_REPOSITORY to owner/repository.')
    return dict(mode='supabase',supabaseUrl=url.rstrip('/'),publishableKey=key,generatorRepository=repo)
def build(out,config):
    out=Path(out)
    # Refuse a nonempty directory instead of deleting unknown/user files.
    out.mkdir(parents=True,exist_ok=True)
    if any(out.iterdir()): raise ValueError('Output directory must be empty.')
    for name in FILES: shutil.copyfile(ROOT/'static'/name,out/name)
    (out/'config.js').write_text('window.MEADOW_CONFIG = '+json.dumps(config)+';\n',encoding='utf-8')
    (out/'.nojekyll').touch()
    # CSP travels with the static page because Pages does not support custom headers.
    index=(out/'index.html').read_text(encoding='utf-8')
    csp="default-src 'self'; script-src 'self'; style-src 'self'; connect-src "+config['supabaseUrl']+"; img-src 'self' "+config['supabaseUrl']+"; object-src 'none'; base-uri 'self'; form-action 'self'"
    index=index.replace('<meta name="viewport"', '<meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="viewport"')
    (out/'index.html').write_text(index,encoding='utf-8')
def main():
    p=argparse.ArgumentParser();p.add_argument('--output',default='site');a=p.parse_args()
    try:
        config=public_config(os.environ.get('MEADOW_SUPABASE_URL',''),os.environ.get('MEADOW_SUPABASE_PUBLIC_KEY',''),os.environ.get('MEADOW_GENERATOR_REPOSITORY',''))
        build(a.output,config);print('Public interface built. No editions, votes, preferences, backups or private credentials copied.')
    except ValueError as e:p.error(str(e))
if __name__=='__main__':main()
