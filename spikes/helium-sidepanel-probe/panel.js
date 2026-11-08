document.getElementById('w').textContent = 'Panel width: ' + window.innerWidth + ' px';
window.addEventListener('resize', () => {
  document.getElementById('w').textContent = 'Panel width: ' + window.innerWidth + ' px';
});
