export default function NoToolsState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-muted-foreground mb-2">
          No Tools Enabled
        </h2>
        <p className="text-muted-foreground">
          Enable tools in your environment configuration to see portal
          widgets. Configure integrations using the settings dropdown in
          the top bar.
        </p>
      </div>
    </div>
  );
}
