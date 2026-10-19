"""Retrieve missing archived inputs only; never accept changed bytes or disable TLS."""
import argparse
import json
import ssl
from urllib.request import Request, urlopen
from urllib.parse import urlparse

from build import BASE, sha


def verify(data, source):
    if len(data) != source['bytes'] or sha(data) != source['sha256']:
        raise ValueError(f"Changed source bytes: {source['path']}; retain archive, investigate a new edition separately")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true', help='Enable network retrieval of missing files; otherwise only list them')
    args = parser.parse_args()
    sources = json.loads((BASE / 'inputs/sources.json').read_text(encoding='utf-8'))['sources']
    for source in sources:
        target = BASE / source['path']
        if target.exists():
            verify(target.read_bytes(), source)
            continue
        print('Missing:', source['path'])
        if not args.fetch:
            continue
        url = source['url']
        if urlparse(url).scheme != 'https':
            raise ValueError('Only verified HTTPS sources may be retrieved')
        request = Request(url, headers={'User-Agent': 'DelhiCrimeDashboard-HistoricalSourceResearch/1.0'})
        with urlopen(request, timeout=45, context=ssl.create_default_context()) as response:
            if urlparse(response.url).scheme != 'https':
                raise ValueError('Refusing a downgrade to non-HTTPS')
            data = response.read(source['bytes'] + 1)
        verify(data, source)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)


if __name__ == '__main__':
    main()
