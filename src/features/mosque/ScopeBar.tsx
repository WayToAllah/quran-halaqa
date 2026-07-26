import { useMosque } from './MosqueContext';
import { MosqueSwitcher } from './MosqueSwitcher';
import { HalaqaSwitcher } from './HalaqaSwitcher';

/**
 * The bar under the header holding the mosque and halaqa pickers. It renders
 * nothing at all when there's only one mosque AND one halaqa — i.e. the
 * original single-circle setup is visually untouched. Each picker also hides
 * itself individually, so a mosque with several halaqat shows just the halaqa
 * picker, and a teacher in several mosques with one circle each shows just
 * the mosque picker.
 */
export function ScopeBar() {
  const { mosques, halaqat } = useMosque();

  const showMosque = mosques.length > 1;
  const showHalaqa = halaqat.length > 1;
  if (!showMosque && !showHalaqa) return null;

  return (
    <div class="bg-forest/5 border-b border-hairline px-[18px] py-2 flex items-center gap-3 flex-wrap">
      <MosqueSwitcher />
      <HalaqaSwitcher />
    </div>
  );
}
