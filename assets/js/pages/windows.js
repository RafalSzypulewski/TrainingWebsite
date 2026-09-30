(function () {
  document.getElementById('popup-btn').addEventListener('click', () => {
    window.open('popup.html?from=window.open', 'pw-popup', 'width=480,height=320');
  });

  // Custom element with an open shadow root.
  class UserCard extends HTMLElement {
    connectedCallback() {
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          .card { border: 1px solid #d5dae6; border-radius: 10px; padding: 16px; font-family: system-ui, sans-serif; background: #fff; }
          label { display: block; font-weight: 600; margin-bottom: 4px; }
          input { padding: 8px 10px; border: 1px solid #d5dae6; border-radius: 6px; font: inherit; width: 100%; box-sizing: border-box; }
          button { margin-top: 10px; padding: 8px 14px; border: 0; border-radius: 6px; background: #4f46e5; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
          p { margin: 10px 0 0; }
        </style>
        <div class="card">
          <h3 part="title">${this.getAttribute('name') ?? 'User'}</h3>
          <label for="nick">Nickname</label>
          <input id="nick" type="text" placeholder="Enter a nickname">
          <button type="button" id="greet">Greet</button>
          <p id="greeting" role="status"></p>
        </div>`;
      root.getElementById('greet').addEventListener('click', () => {
        const nick = root.getElementById('nick').value || 'friend';
        root.getElementById('greeting').textContent = `Hi ${nick}, welcome back!`;
      });
    }
  }
  customElements.define('user-card', UserCard);
})();
