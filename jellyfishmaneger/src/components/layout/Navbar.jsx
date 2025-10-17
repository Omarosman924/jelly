import Controls from "./Controls";
import Logo from "./Logo";

export default function Navbar() {
  return (
    <>
      <nav>
        <div className="container-fluid">
          <div className="d-flex align-items-center flex-wrap py-2 justify-content-sm-between justify-content-center flex-grow-1 g-3">
            <Logo />
            <Controls />
          </div>
        </div>
      </nav>
    </>
  );
}
