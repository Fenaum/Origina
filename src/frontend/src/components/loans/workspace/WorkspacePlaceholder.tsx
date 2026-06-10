// Generic workspace body for tabs that have a reserved route but no full
// implementation yet. Keeps future sections visually consistent while the
// underlying workflow is still being modeled.
type Props = {
  title: string;
  description: string;
};

export function WorkspacePlaceholder({ title, description }: Props) {
  return (
    <div className="workspace-placeholder">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
