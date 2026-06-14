import { readFile } from '@web/test-runner-commands';
import { expect } from '@esm-bundle/chai';

const { default: init } = await import('../../../blocks/forge-new-block-7/forge-new-block-7.js');

describe('forge-new-block-7 (hidden alternate)', () => {
  before(async () => {
    document.body.innerHTML = await readFile({ path: './mocks/body.html' });
  });

  it('marks the block hidden and aria-hidden', async () => {
    const block = document.querySelector('.forge-new-block-7');
    expect(block).to.exist;
    await init(block);
    expect(block.hasAttribute('hidden')).to.equal(true);
    expect(block.getAttribute('aria-hidden')).to.equal('true');
  });

  it('renders no visible content', async () => {
    const block = document.querySelector('.forge-new-block-7');
    await init(block);
    expect(block.querySelector('img, picture, svg, video')).to.equal(null);
    expect(block.textContent.trim()).to.equal('');
  });
});
