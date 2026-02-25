import React, { useState } from 'react';
import Header from './components/Header';
import SwapInterface from './components/SwapInterface';

function App() {
  const [publicKey, setPublicKey] = useState(null);

  return (
    <main>


      <section>
        <h2>WALLET DETAILS</h2>
        <Header onConnect={setPublicKey} />
      </section>

      <SwapInterface publicKey={publicKey} />
    </main>
  );
}

export default App;
