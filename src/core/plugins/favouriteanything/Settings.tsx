import { Forms } from "@vendetta/ui/components";
const { FormSection, FormText } = Forms;

export default () => (
    <FormSection title="FavouriteAnything">
        <FormText>
            Adds the favourite button to ALL media in the image viewer, not just GIFs!
        </FormText>
        <FormText style={{ marginTop: 8, color: "#b9bbbe" }}>
            Images and videos can now be saved to your GIF favourites picker. Works by patching Discord's GIFFavButton to accept all media types.
        </FormText>
    </FormSection>
)
