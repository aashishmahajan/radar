function renderButtons(radarFooter) {
  const buttonsRow = radarFooter.append('div').classed('buttons', true)

  buttonsRow
    .append('button')
    .classed('buttons__wave-btn', true)
    .text('Print this Radar')
    .on('click', window.print.bind(window))

  buttonsRow
    .append('a')
    .classed('buttons__flamingo-btn', true)
    .attr('href', window.location.href.substring(0, window.location.href.indexOf(window.location.search)))
    .text('Generate new Radar')

  const linksRow = radarFooter.append('div').classed('upload-footer__links', true)

  linksRow
    .append('a')
    .attr('href', '/')
    .attr('class', 'upload-footer__link')
    .text('View landing page')

  linksRow
    .append('a')
    .attr('href', '/upload.html')
    .attr('class', 'upload-footer__link')
    .text('Upload a new file')

  linksRow
    .append('a')
    .attr('href', '/files/')
    .attr('target', '_blank')
    .attr('rel', 'noopener noreferrer')
    .attr('class', 'upload-footer__link')
    .text('View all files')

  linksRow
    .append('a')
    .attr('href', '/?noLatest=1')
    .attr('class', 'upload-footer__link')
    .text('Start a new radar')
}

module.exports = {
  renderButtons,
}
