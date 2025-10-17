import PromotionsBanner from "@/components/home/PromotionsBanner/PromotionsBanner";
import { useTranslations } from "next-intl";
import OrderMenu from "@/components/home/order/OrderMenu";
import Menu from "@/components/home/menu/Menu";

export default function Home() {
  const t = useTranslations();

  return (
    <div className="container-fluid">
      <div className="row justify-content-center align-items-start">
        <main className="col-xxl-9 col-xl-8 col-lg-7 col-md-12">
          <PromotionsBanner />
          <Menu />
        </main>
        <aside className="col-xxl-3 col-xl-4 col-lg-5 d-none d-lg-block position-relative">
          <div className="position-absolute top-0 end-0 start-0 me-2 menuOrder">
            <OrderMenu />
          </div>
        </aside>
      </div>
    </div>
  );
}
